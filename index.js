// 必要なパッケージのインポート
require('dotenv').config(); // 環境変数を読み込むための設定
const axios = require('axios'); // HTTP通信を行うためのライブラリ
const readline = require('readline'); // コマンドラインでの対話操作のためのモジュール

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

// コンソールでの対話操作設定
const rl = readline.createInterface({
  input: process.stdin, // 標準入力
  output: process.stdout // 標準出力
});

// ユーザーに質問を投げかけ回答を取得する関数
function ask(question) {
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

// データベースのプロパティ構造を取得する関数
async function getDatabaseProperties() {
  try {
    const response = await notionClient.get(`/databases/${NOTION_DATABASE_ID}`);
    return response.data.properties; // データベースのプロパティ構造を返す
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// データベース内のページ一覧を取得する関数
async function listPages() {
  try {
    const response = await notionClient.post(`/databases/${NOTION_DATABASE_ID}/query`);
    return response.data.results; // ページのリストを返す
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// 新しいページを作成する関数
async function createPage(properties, blocks = []) {
  try {
    const requestBody = {
      parent: { database_id: NOTION_DATABASE_ID }, // 親データベースの指定
      properties: properties // ページのプロパティ
    };
    
    // ブロック（コンテンツ）がある場合は追加
    if (blocks.length > 0) {
      requestBody.children = blocks;
    }
    
    const response = await notionClient.post('/pages', requestBody);
    return response.data; // 作成されたページの情報を返す
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// ページを更新する関数
async function updatePage(pageId, properties) {
  try {
    const response = await notionClient.patch(`/pages/${pageId}`, {
      properties: properties // 更新するプロパティ
    });
    return response.data; // 更新されたページの情報を返す
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// ページを削除（アーカイブ）する関数
async function deletePage(pageId) {
  try {
    const response = await notionClient.patch(`/pages/${pageId}`, {
      archived: true // trueを設定するとページがアーカイブ（削除）される
    });
    return response.data; // 削除されたページの情報を返す
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// ページにブロック（コンテンツ）を追加する関数
async function addBlocksToPage(pageId, blocks) {
  try {
    const response = await notionClient.patch(`/blocks/${pageId}/children`, {
      children: blocks // 追加するブロックの配列
    });
    return response.data; // 更新されたブロック情報を返す
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// メインメニューを表示して操作を選択する関数
async function showMainMenu() {
  console.log('\n===== Notion操作ツール =====');
  console.log('1: ページ一覧表示');
  console.log('2: 新規ページ作成');
  console.log('3: ページ更新');
  console.log('4: ページ削除');
  console.log('0: 終了');
  
  const choice = await ask('\n操作を選択してください (0-4): ');
  return choice;
}

// ページ一覧を表示する処理
async function showPageList() {
  try {
    console.log('\nページ一覧を取得中...');
    const pages = await listPages();
    
    if (pages.length === 0) {
      console.log('ページが見つかりません。');
      return null;
    }
    
    // データベースのプロパティ構造を取得
    const dbProperties = await getDatabaseProperties();
    
    // タイトルプロパティを特定
    const titleProperty = Object.keys(dbProperties).find(
      key => dbProperties[key].type === 'title'
    );
    
    // ページ一覧を表示
    console.log(`\n全${pages.length}件のページ:`);
    pages.forEach((page, index) => {
      let title = '無題';
      if (titleProperty && page.properties[titleProperty].title.length > 0) {
        title = page.properties[titleProperty].title[0].plain_text;
      }
      console.log(`${index + 1}: ${title}`);
    });
    
    return { pages, titleProperty };
  } catch (error) {
    console.error('ページ一覧の取得に失敗しました:', error);
    return null;
  }
}

// 新規ページを作成する処理
async function handleCreatePage() {
  try {
    console.log('\n新規ページ作成:');
    
    // データベースのプロパティ構造を取得
    const dbProperties = await getDatabaseProperties();
    
    // タイトルプロパティを特定
    const titleProperty = Object.keys(dbProperties).find(
      key => dbProperties[key].type === 'title'
    );
    
    if (!titleProperty) {
      console.log('データベースにタイトルプロパティが見つかりません。');
      return;
    }
    
    // 新規ページのプロパティを構築
    const properties = {};
    
    // タイトル入力
    const title = await ask('タイトルを入力してください: ');
    properties[titleProperty] = {
      title: [{ text: { content: title } }]
    };
    
    // その他のプロパティを設定
    for (const [key, prop] of Object.entries(dbProperties)) {
      if (key === titleProperty) continue; // タイトルは既に設定済み
      
      // テキスト、数値、日付、セレクトなど、よく使われるプロパティタイプに対応
      if (['rich_text', 'number', 'date', 'select', 'checkbox'].includes(prop.type)) {
        console.log(`\n${key} (${prop.type}):`);
        const value = await ask('値を入力してください (スキップする場合は空欄): ');
        
        if (value.trim() === '') continue; // 空欄の場合はスキップ
        
        switch (prop.type) {
          case 'rich_text':
            properties[key] = {
              rich_text: [{ text: { content: value } }]
            };
            break;
          case 'number':
            properties[key] = {
              number: parseFloat(value)
            };
            break;
          case 'date':
            properties[key] = {
              date: { start: value }
            };
            break;
          case 'select':
            properties[key] = {
              select: { name: value }
            };
            break;
          case 'checkbox':
            properties[key] = {
              checkbox: value.toLowerCase() === 'true' || 
                       value.toLowerCase() === 'yes' || 
                       value.toLowerCase() === 'はい'
            };
            break;
        }
      }
    }
    
    // ページコンテンツを追加するか確認
    const addContent = await ask('\nページにコンテンツを追加しますか？ (yes/no): ');
    
    let blocks = [];
    if (addContent.toLowerCase() === 'yes' || addContent.toLowerCase() === 'y') {
      // シンプルな段落を追加
      const content = await ask('コンテンツを入力してください: ');
      blocks = [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content } }]
          }
        }
      ];
    }
    
    // ページ作成実行
    console.log('\nページを作成中...');
    const newPage = await createPage(properties, blocks);
    console.log(`ページを作成しました。URL: ${newPage.url}`);
    
  } catch (error) {
    console.error('ページ作成に失敗しました:', error);
  }
}

// ページを更新する処理
async function handleUpdatePage() {
  try {
    console.log('\nページ更新:');
    
    // ページ一覧を表示
    const result = await showPageList();
    if (!result) return;
    
    const { pages, titleProperty } = result;
    
    // 更新するページを選択
    const pageIndex = parseInt(await ask('\n更新するページの番号を選択してください: ')) - 1;
    
    if (isNaN(pageIndex) || pageIndex < 0 || pageIndex >= pages.length) {
      console.log('無効な選択です。');
      return;
    }
    
    const selectedPage = pages[pageIndex];
    
    // データベースのプロパティ構造を取得
    const dbProperties = await getDatabaseProperties();
    
    // 更新するプロパティを構築
    const properties = {};
    
    // 更新可能なプロパティを表示
    console.log('\n更新可能なプロパティ:');
    Object.entries(dbProperties).forEach(([key, prop], index) => {
      console.log(`${index + 1}: ${key} (${prop.type})`);
    });
    
    // 更新するプロパティを選択
    const propIndex = parseInt(await ask('\n更新するプロパティの番号を選択してください: ')) - 1;
    
    if (isNaN(propIndex) || propIndex < 0 || propIndex >= Object.keys(dbProperties).length) {
      console.log('無効な選択です。');
      return;
    }
    
    const propKey = Object.keys(dbProperties)[propIndex];
    const propType = dbProperties[propKey].type;
    
    // 新しい値を入力
    const newValue = await ask(`${propKey}の新しい値を入力してください: `);
    
    // プロパティタイプに応じた値の設定
    switch (propType) {
      case 'title':
        properties[propKey] = {
          title: [{ text: { content: newValue } }]
        };
        break;
      case 'rich_text':
        properties[propKey] = {
          rich_text: [{ text: { content: newValue } }]
        };
        break;
      case 'number':
        properties[propKey] = {
          number: parseFloat(newValue)
        };
        break;
      case 'date':
        properties[propKey] = {
          date: { start: newValue }
        };
        break;
      case 'select':
        properties[propKey] = {
          select: { name: newValue }
        };
        break;
      case 'checkbox':
        properties[propKey] = {
          checkbox: newValue.toLowerCase() === 'true' || 
                   newValue.toLowerCase() === 'yes' || 
                   newValue.toLowerCase() === 'はい'
        };
        break;
      default:
        console.log(`このプロパティタイプ (${propType}) はサポートされていません。`);
        return;
    }
    
    // ページ更新実行
    console.log('\nページを更新中...');
    await updatePage(selectedPage.id, properties);
    console.log('ページを更新しました。');
    
    // ページのコンテンツ（ブロック）を追加するか確認
    const addBlocks = await ask('\nページに新しいコンテンツを追加しますか？ (yes/no): ');
    
    if (addBlocks.toLowerCase() === 'yes' || addBlocks.toLowerCase() === 'y') {
      const blockContent = await ask('追加するコンテンツを入力してください: ');
      
      const blocks = [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: blockContent } }]
          }
        }
      ];
      
      console.log('\nコンテンツを追加中...');
      await addBlocksToPage(selectedPage.id, blocks);
      console.log('コンテンツを追加しました。');
    }
    
  } catch (error) {
    console.error('ページ更新に失敗しました:', error);
  }
}

// ページを削除する処理
async function handleDeletePage() {
  try {
    console.log('\nページ削除:');
    
    // ページ一覧を表示
    const result = await showPageList();
    if (!result) return;
    
    const { pages, titleProperty } = result;
    
    // 削除するページを選択
    const pageIndex = parseInt(await ask('\n削除するページの番号を選択してください: ')) - 1;
    
    if (isNaN(pageIndex) || pageIndex < 0 || pageIndex >= pages.length) {
      console.log('無効な選択です。');
      return;
    }
    
    const selectedPage = pages[pageIndex];
    let title = '無題';
    if (titleProperty && selectedPage.properties[titleProperty].title.length > 0) {
      title = selectedPage.properties[titleProperty].title[0].plain_text;
    }
    
    // 削除確認
    const confirm = await ask(`\n「${title}」を削除しますか？ この操作は元に戻せません。 (yes/no): `);
    
    if (confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y') {
      console.log('\nページを削除中...');
      await deletePage(selectedPage.id);
      console.log('ページを削除しました。');
    } else {
      console.log('削除をキャンセルしました。');
    }
    
  } catch (error) {
    console.error('ページ削除に失敗しました:', error);
  }
}

// メイン処理
async function main() {
  try {
    // 環境変数のチェック
    if (!NOTION_KEY || !NOTION_DATABASE_ID) {
      console.error('環境変数が正しく設定されていません。');
      console.error('.envファイルに NOTION_KEY と NOTION_DATABASE_ID を設定してください。');
      rl.close();
      return;
    }
    
    let exit = false;
    
    while (!exit) {
      const choice = await showMainMenu();
      
      switch (choice) {
        case '0': // 終了
          exit = true;
          console.log('\nプログラムを終了します。');
          break;
        case '1': // ページ一覧表示
          await showPageList();
          break;
        case '2': // 新規ページ作成
          await handleCreatePage();
          break;
        case '3': // ページ更新
          await handleUpdatePage();
          break;
        case '4': // ページ削除
          await handleDeletePage();
          break;
        default:
          console.log('無効な選択です。再度選択してください。');
      }
    }
    
    rl.close();
    
  } catch (error) {
    console.error('予期せぬエラーが発生しました:', error);
    rl.close();
  }
}

// プログラム実行
main();