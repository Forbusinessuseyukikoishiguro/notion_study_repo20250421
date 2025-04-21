// 必要なパッケージのインポート
require('dotenv').config(); // 環境変数を読み込む
const axios = require('axios'); // HTTP通信ライブラリ
const fs = require('fs').promises; // ファイル操作用

// Notion APIの設定
const NOTION_KEY = process.env.NOTION_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
const NOTION_API_BASE = 'https://api.notion.com/v1';

// APIリクエスト用の共通設定
const notionClient = axios.create({
  baseURL: NOTION_API_BASE,
  headers: {
    'Authorization': `Bearer ${NOTION_KEY}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28' // 最新バージョンを使用 (更新する可能性あり)
  }
});

// エラーハンドラー関数
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
    // リクエスト設定時に何か問題が発生
    console.error('エラー:', error.message);
  }
  console.error('エラースタック:', error.stack);
}

// データベース一覧を取得する関数 (searchエンドポイントを使用)
async function listDatabases() {
  try {
    // 最新のAPIではsearchエンドポイントを使用してデータベースを検索する
    const response = await notionClient.post('/search', {
      filter: {
        value: "database",
        property: "object"
      },
      sort: {
        direction: "ascending",
        timestamp: "last_edited_time"
      }
    });
    return response.data;
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// 特定のデータベースの詳細を取得する関数
async function getDatabase(databaseId) {
  try {
    const response = await notionClient.get(`/databases/${databaseId}`);
    return response.data;
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// データベースの内容をクエリする関数 - 修正版
async function queryDatabase(databaseId, filter = null) {
  try {
    // フィルターが指定されている場合のみfilterプロパティを含める
    const requestBody = filter ? { filter } : {};
    
    const response = await notionClient.post(
      `/databases/${databaseId}/query`, 
      requestBody
    );
    return response.data;
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// 新しいページを作成する関数
async function createPage(databaseId, properties) {
  try {
    const response = await notionClient.post('/pages', {
      parent: { database_id: databaseId },
      properties: properties
    });
    return response.data;
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// 既存のページを更新する関数
async function updatePage(pageId, properties) {
  try {
    const response = await notionClient.patch(`/pages/${pageId}`, {
      properties: properties
    });
    return response.data;
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// ページの詳細を取得する関数
async function getPage(pageId) {
  try {
    const response = await notionClient.get(`/pages/${pageId}`);
    return response.data;
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// ページのブロック（コンテンツ）を取得する関数
async function getPageBlocks(pageId) {
  try {
    const response = await notionClient.get(`/blocks/${pageId}/children`);
    return response.data;
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// ページにブロックを追加する関数
async function appendBlocksToPage(pageId, blocks) {
  try {
    const response = await notionClient.patch(`/blocks/${pageId}/children`, {
      children: blocks
    });
    return response.data;
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// レスポンスデータをJSONファイルに保存する補助関数
async function saveToFile(data, filename) {
  try {
    await fs.writeFile(
      filename, 
      JSON.stringify(data, null, 2), 
      'utf-8'
    );
    console.log(`データを ${filename} に保存しました`);
  } catch (error) {
    console.error(`ファイル保存エラー: ${error.message}`);
    throw error;
  }
}

// メイン関数（実際の操作を行う）
async function main() {
  try {
    // 1. データベースの検索を実行
    console.log('データベース一覧を検索中...');
    const searchResults = await listDatabases();
    console.log(`${searchResults.results.length}件のデータベースが見つかりました`);
    
    // 検索結果をファイルに保存
    await saveToFile(searchResults, 'database-list.json');
    
    // データベースが見つかったか確認
    if (searchResults.results.length === 0) {
      console.log('アクセス可能なデータベースが見つかりませんでした。');
      console.log('以下を確認してください:');
      console.log('1. 統合にデータベースへのアクセス権があるか');
      console.log('2. 統合トークンが正しいか');
      return;
    }
    
    // 2. 特定のデータベースの詳細を取得
    let targetDatabaseId = NOTION_DATABASE_ID;
    
    // もしデータベースIDが設定されていない場合は、最初に見つかったデータベースを使用
    if (!targetDatabaseId && searchResults.results.length > 0) {
      targetDatabaseId = searchResults.results[0].id;
      console.log(`環境変数にデータベースIDが設定されていないため、最初に見つかったデータベースを使用します: ${targetDatabaseId}`);
    }
    
    if (!targetDatabaseId) {
      console.log('データベースIDが見つかりません。終了します。');
      return;
    }
    
    // データベースの詳細を取得
    console.log(`データベース(${targetDatabaseId})の詳細を取得中...`);
    const dbDetails = await getDatabase(targetDatabaseId);
    console.log(`データベース「${dbDetails.title?.[0]?.plain_text || 'Untitled'}」の詳細を取得しました`);
    await saveToFile(dbDetails, 'database-details.json');
    
    // 3. データベースの内容を取得
    console.log(`データベース(${targetDatabaseId})の内容をクエリ中...`);
    // filterなしで実行
    const dbContents = await queryDatabase(targetDatabaseId);
    console.log(`${dbContents.results.length}件のレコードを取得しました`);
    await saveToFile(dbContents, 'database-contents.json');
    
    // データベースが空の場合は新しいページを追加
    if (dbContents.results.length === 0) {
      console.log('データベースが空のため、サンプルページを作成します');
      
      // データベースのプロパティ構造を確認
      const propertySchema = dbDetails.properties;
      
      // 動的にプロパティを構築（データベースの構造に合わせる）
      const newPageProperties = {};
      
      // タイトルプロパティを見つける
      const titleProperty = Object.keys(propertySchema).find(
        key => propertySchema[key].type === 'title'
      );
      
      if (titleProperty) {
        newPageProperties[titleProperty] = {
          title: [{ text: { content: "NotionAPIからのサンプルページ" } }]
        };
      }
      
      // セレクトプロパティがあれば設定
      Object.keys(propertySchema).forEach(key => {
        const prop = propertySchema[key];
        if (prop.type === 'select' && prop.select.options.length > 0) {
          newPageProperties[key] = {
            select: { name: prop.select.options[0].name }
          };
        } else if (prop.type === 'date') {
          // 日付プロパティがあれば現在の日付を設定
          const today = new Date().toISOString().split('T')[0];
          newPageProperties[key] = {
            date: { start: today }
          };
        } else if (prop.type === 'rich_text' && key !== titleProperty) {
          // リッチテキストプロパティがあれば設定
          newPageProperties[key] = {
            rich_text: [{ text: { content: "NotionAPIからのサンプルテキスト" } }]
          };
        }
      });
      
      console.log('新しいページを作成中...');
      const newPage = await createPage(targetDatabaseId, newPageProperties);
      console.log('新しいページを作成しました:', newPage.id);
      await saveToFile(newPage, 'new-page.json');
      
      // 4. ページにコンテンツブロックを追加
      console.log('ページにブロックを追加中...');
      const blocks = [
        {
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [{ type: "text", text: { content: "NotionAPIで作成したページ" } }]
          }
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              { 
                type: "text", 
                text: { 
                  content: "このページはNotionのAPIを使って自動的に作成されました。" 
                } 
              }
            ]
          }
        },
        {
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [{ type: "text", text: { content: "データの自動追加" } }]
          }
        },
        {
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [{ type: "text", text: { content: "ワークフロー自動化" } }]
          }
        },
        {
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [{ type: "text", text: { content: "外部アプリとの連携" } }]
          }
        }
      ];
      
      const updatedBlocks = await appendBlocksToPage(newPage.id, blocks);
      console.log('ブロックを追加しました');
      await saveToFile(updatedBlocks, 'blocks-added.json');
      
      // 5. ページのプロパティを更新
      console.log('ページプロパティを更新中...');
      
      // 更新するプロパティを準備（データベース構造に応じて適宜変更）
      const updateProperties = {};
      
      // セレクトプロパティがあれば2番目の選択肢に更新
      Object.keys(propertySchema).forEach(key => {
        const prop = propertySchema[key];
        if (prop.type === 'select' && prop.select.options.length > 1) {
          updateProperties[key] = {
            select: { name: prop.select.options[1].name }
          };
        }
      });
      
      // 更新するプロパティがあれば実行
      if (Object.keys(updateProperties).length > 0) {
        const updatedPage = await updatePage(newPage.id, updateProperties);
        console.log('ページプロパティを更新しました');
        await saveToFile(updatedPage, 'updated-page.json');
      } else {
        console.log('更新するプロパティが見つかりませんでした');
      }
    } else {
      console.log('データベースに既存のページがあります。最初のページを表示します:');
      const firstPage = dbContents.results[0];
      console.log(`ページID: ${firstPage.id}`);
      
      // ページの詳細を取得
      console.log('ページの詳細を取得中...');
      const pageDetails = await getPage(firstPage.id);
      console.log('ページの詳細を取得しました');
      await saveToFile(pageDetails, 'page-details.json');
      
      // ページのブロックを取得
      console.log('ページのブロック（コンテンツ）を取得中...');
      const pageBlocks = await getPageBlocks(firstPage.id);
      console.log(`${pageBlocks.results.length}件のブロックを取得しました`);
      await saveToFile(pageBlocks, 'page-blocks.json');
    }
    
    console.log('処理が完了しました');
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

// メイン関数を実行
main();