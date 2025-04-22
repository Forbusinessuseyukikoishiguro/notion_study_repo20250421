// 必要なパッケージのインポート
require('dotenv').config(); // 環境変数を読み込むための設定
const axios = require('axios'); // HTTP通信を行うためのライブラリ
const readline = require('readline'); // コマンドラインで対話するためのモジュール

// Notion APIの設定
const NOTION_KEY = process.env.NOTION_KEY; // 環境変数からAPIキーを取得
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID; // 環境変数からデータベースIDを取得
const NOTION_API_BASE = 'https://api.notion.com/v1'; // NotionのAPIのベースURL

// APIリクエスト用の共通設定
const notionClient = axios.create({
  baseURL: NOTION_API_BASE, // ベースURLの設定
  headers: {
    'Authorization': `Bearer ${NOTION_KEY}`, // 認証トークンの設定
    'Content-Type': 'application/json', // コンテンツタイプをJSONに設定
    'Notion-Version': '2022-06-28' // 使用するAPIのバージョン
  }
});

// コンソールで対話するためのインターフェース設定
const rl = readline.createInterface({
  input: process.stdin, // 標準入力
  output: process.stdout // 標準出力
});

// 質問をして回答を受け取るユーティリティ関数
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// エラーハンドリング関数
function handleError(error) {
  if (error.response) {
    // APIからのレスポンスがあるエラー
    console.error('エラーレスポンス:', {
      status: error.response.status,
      data: error.response.data
    });
  } else if (error.request) {
    // リクエストは送信されたがレスポンスがない
    console.error('レスポンスが受信できませんでした:', error.request);
  } else {
    // リクエスト設定時に問題が発生
    console.error('エラー:', error.message);
  }
}

// データベースの内容を取得する関数
async function getDatabaseContents() {
  try {
    // データベースの内容をクエリ
    const response = await notionClient.post(`/databases/${NOTION_DATABASE_ID}/query`);
    return response.data.results; // データベースの内容を返す
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// ページを更新する関数
async function updatePage(pageId, properties) {
  try {
    // ページのプロパティを更新するPATCHリクエスト
    const response = await notionClient.patch(`/pages/${pageId}`, {
      properties: properties
    });
    return response.data;
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// ページを削除する関数（Notionでは実際にはアーカイブする）
async function deletePage(pageId) {
  try {
    // ページをアーカイブするPATCHリクエスト
    const response = await notionClient.patch(`/pages/${pageId}`, {
      archived: true // trueでアーカイブ（削除相当）
    });
    return response.data;
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// ページの詳細を取得する関数
async function getPageDetails(pageId) {
  try {
    // ページの詳細を取得するGETリクエスト
    const response = await notionClient.get(`/pages/${pageId}`);
    return response.data;
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// データベースのプロパティ情報を取得する関数
async function getDatabaseProperties() {
  try {
    // データベースの詳細を取得
    const response = await notionClient.get(`/databases/${NOTION_DATABASE_ID}`);
    return response.data.properties; // データベースのプロパティ構造を返す
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// メインの実行関数
async function main() {
  try {
    console.log('Notionデータベース管理ツール');
    console.log('==========================');
    
    // データベースのプロパティ構造を取得
    const dbProperties = await getDatabaseProperties();
    
    // タイトルプロパティを特定（表示用）
    const titleProperty = Object.keys(dbProperties).find(
      key => dbProperties[key].type === 'title'
    );
    
    // データベースの内容を取得して表示
    console.log('\nデータベースの内容を取得中...');
    const pages = await getDatabaseContents();
    
    if (pages.length === 0) {
      console.log('データベースにページが見つかりませんでした。');
      rl.close();
      return;
    }
    
    // 取得したページを一覧表示
    console.log(`\n${pages.length}件のページが見つかりました:\n`);
    pages.forEach((page, index) => {
      // タイトルを取得して表示（ない場合は「無題」）
      let title = '無題';
      if (titleProperty && page.properties[titleProperty].title.length > 0) {
        title = page.properties[titleProperty].title[0].plain_text;
      }
      console.log(`${index + 1}. ${title} (ID: ${page.id})`);
    });
    
    // ユーザーにページ選択を促す
    const selectedIndex = parseInt(await askQuestion('\n操作するページの番号を入力してください: ')) - 1;
    
    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= pages.length) {
      console.log('無効な選択です。');
      rl.close();
      return;
    }
    
    const selectedPage = pages[selectedIndex];
    
    // 選択したページの詳細を表示
    console.log('\n選択したページの詳細:');
    const pageDetails = await getPageDetails(selectedPage.id);
    
    // ページのプロパティを表示
    console.log('\nプロパティ一覧:');
    Object.entries(pageDetails.properties).forEach(([key, value]) => {
      let displayValue = '';
      
      // プロパティタイプに応じた表示方法
      switch (value.type) {
        case 'title':
          displayValue = value.title[0]?.plain_text || '';
          break;
        case 'rich_text':
          displayValue = value.rich_text[0]?.plain_text || '';
          break;
        case 'select':
          displayValue = value.select?.name || '';
          break;
        case 'date':
          displayValue = value.date?.start || '';
          break;
        case 'checkbox':
          displayValue = value.checkbox ? 'はい' : 'いいえ';
          break;
        case 'number':
          displayValue = value.number !== null ? value.number.toString() : '';
          break;
        default:
          displayValue = '(表示非対応の形式)';
      }
      
      console.log(`${key}: ${displayValue}`);
    });
    
    // 実行したい操作を選択
    console.log('\n実行できる操作:');
    console.log('1. ページを更新');
    console.log('2. ページを削除');
    console.log('3. キャンセル');
    
    const operation = await askQuestion('\n操作を選択してください (1-3): ');
    
    if (operation === '1') {
      // 更新操作
      console.log('\nページの更新を選択しました。');
      
      // 更新するプロパティを選択
      console.log('\n更新可能なプロパティ:');
      
      const editableProperties = Object.entries(dbProperties)
        .filter(([_, prop]) => ['title', 'rich_text', 'number', 'select', 'checkbox', 'date'].includes(prop.type))
        .map(([key, prop]) => ({ name: key, type: prop.type }));
      
      editableProperties.forEach((prop, index) => {
        console.log(`${index + 1}. ${prop.name} (タイプ: ${prop.type})`);
      });
      
      const propIndex = parseInt(await askQuestion('\n更新するプロパティの番号を入力してください: ')) - 1;
      
      if (isNaN(propIndex) || propIndex < 0 || propIndex >= editableProperties.length) {
        console.log('無効な選択です。');
        rl.close();
        return;
      }
      
      const propToUpdate = editableProperties[propIndex];
      let newValue = await askQuestion(`\n「${propToUpdate.name}」の新しい値を入力してください: `);
      
      // プロパティの値を更新するオブジェクトを作成
      const updateData = {};
      
      // プロパティタイプに応じた更新データの構築
      switch (propToUpdate.type) {
        case 'title':
          updateData[propToUpdate.name] = {
            title: [{ text: { content: newValue } }]
          };
          break;
        case 'rich_text':
          updateData[propToUpdate.name] = {
            rich_text: [{ text: { content: newValue } }]
          };
          break;
        case 'number':
          updateData[propToUpdate.name] = {
            number: parseFloat(newValue)
          };
          break;
        case 'checkbox':
          updateData[propToUpdate.name] = {
            checkbox: newValue.toLowerCase() === 'true' || newValue.toLowerCase() === 'はい'
          };
          break;
        case 'select':
          updateData[propToUpdate.name] = {
            select: { name: newValue }
          };
          break;
        case 'date':
          updateData[propToUpdate.name] = {
            date: { start: newValue }
          };
          break;
      }
      
      // ページを更新
      console.log('\nページを更新中...');
      await updatePage(selectedPage.id, updateData);
      console.log('ページを更新しました！');
      
    } else if (operation === '2') {
      // 削除操作
      console.log('\nページの削除を選択しました。');
      const confirmation = await askQuestion('本当に削除しますか？ (yes/no): ');
      
      if (confirmation.toLowerCase() === 'yes') {
        console.log('\nページを削除中...');
        await deletePage(selectedPage.id);
        console.log('ページを削除しました！');
      } else {
        console.log('削除をキャンセルしました。');
      }
      
    } else {
      // キャンセル
      console.log('操作をキャンセルしました。');
    }
    
    rl.close();
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
    rl.close();
  }
}

// メイン関数を実行
main();