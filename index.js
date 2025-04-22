// 必要なパッケージのインポート
require('dotenv').config(); // 環境変数を読み込む
const axios = require('axios'); // HTTP通信ライブラリ
const fs = require('fs').promises; // ファイル操作用（ログ用）

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
    'Notion-Version': '2022-06-28' // 最新バージョンを使用
  }
});

// エラーハンドラー関数
function handleError(error) {
  if (error.response) {
    console.error('エラーレスポンス:', {
      status: error.response.status,
      data: error.response.data
    });
  } else if (error.request) {
    console.error('レスポンスが受信できませんでした:', error.request);
  } else {
    console.error('エラー:', error.message);
  }
  console.error('エラースタック:', error.stack);
}

// データベースの詳細を取得する関数
async function getDatabase(databaseId) {
  try {
    const response = await notionClient.get(`/databases/${databaseId}`);
    return response.data;
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// 新しいページを作成する関数
async function createPage(databaseId, properties, content = null) {
  try {
    const requestBody = {
      parent: { database_id: databaseId },
      properties: properties
    };

    // コンテンツ（children）が指定されている場合は追加
    if (content) {
      requestBody.children = content;
    }

    const response = await notionClient.post('/pages', requestBody);
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

// メイン関数
async function main() {
  try {
    // データベースIDの確認
    if (!NOTION_DATABASE_ID) {
      console.error('環境変数NOTION_DATABASE_IDが設定されていません。');
      console.error('.envファイルを確認してください。');
      return;
    }

    // データベースの詳細を取得
    console.log(`データベース(${NOTION_DATABASE_ID})の詳細を取得中...`);
    const dbDetails = await getDatabase(NOTION_DATABASE_ID);
    console.log(`データベース「${dbDetails.title?.[0]?.plain_text || 'Untitled'}」の詳細を取得しました`);

    // データベースのプロパティ構造を確認
    const propertySchema = dbDetails.properties;
    
    // 新しいページのプロパティを動的に構築
    const newPageProperties = {};
    
    // タイトルプロパティを見つける
    const titleProperty = Object.keys(propertySchema).find(
      key => propertySchema[key].type === 'title'
    );
    
    if (titleProperty) {
      newPageProperties[titleProperty] = {
        title: [{ text: { content: "NotionAPIで自動作成したページ" } }]
      };
    } else {
      console.error('タイトルプロパティが見つかりません。ページを作成できません。');
      return;
    }
    
    // その他のプロパティを設定（必要に応じて）
    Object.keys(propertySchema).forEach(key => {
      const prop = propertySchema[key];
      
      // タイトル以外のプロパティを設定
      if (key !== titleProperty) {
        if (prop.type === 'select' && prop.select.options.length > 0) {
          newPageProperties[key] = {
            select: { name: prop.select.options[0].name }
          };
        } else if (prop.type === 'date') {
          const today = new Date().toISOString().split('T')[0];
          newPageProperties[key] = {
            date: { start: today }
          };
        } else if (prop.type === 'rich_text') {
          newPageProperties[key] = {
            rich_text: [{ text: { content: "自動生成されたコンテンツ" } }]
          };
        } else if (prop.type === 'checkbox') {
          newPageProperties[key] = {
            checkbox: true
          };
        } else if (prop.type === 'number') {
          newPageProperties[key] = {
            number: 100
          };
        }
      }
    });
    
    // ページコンテンツのブロックを定義
    const pageContent = [
      {
        object: "block",
        type: "heading_1",
        heading_1: {
          rich_text: [{ type: "text", text: { content: "自動作成されたNotionページ" } }]
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
                content: "このページはNotionのAPIを使って自動的に作成されました。ブロックコンテンツも自動的に追加されています。" 
              } 
            }
          ]
        }
      },
      {
        object: "block",
        type: "divider",
        divider: {}
      },
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "主な機能" } }]
        }
      },
      {
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ type: "text", text: { content: "データベースへの自動ページ追加" } }]
        }
      },
      {
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ type: "text", text: { content: "複雑なブロック構造の構築" } }]
        }
      },
      {
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ type: "text", text: { content: "プロパティの自動設定" } }]
        }
      },
      {
        object: "block",
        type: "divider",
        divider: {}
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: []
        }
      },
      {
        object: "block",
        type: "toggle",
        toggle: {
          rich_text: [{ type: "text", text: { content: "詳細情報（クリックして展開）" } }],
          children: [
            {
              object: "block",
              type: "paragraph",
              paragraph: {
                rich_text: [{ type: "text", text: { content: "ここに詳細情報を記載できます。" } }]
              }
            },
            {
              object: "block",
              type: "code",
              code: {
                rich_text: [{ type: "text", text: { content: "console.log('Notion API is amazing!');" } }],
                language: "javascript"
              }
            }
          ]
        }
      }
    ];
    
    // ページとコンテンツを一度に作成
    console.log('新しいページとコンテンツを作成中...');
    const newPage = await createPage(NOTION_DATABASE_ID, newPageProperties, pageContent);
    console.log(`新しいページを作成しました: ${newPage.url}`);
    
    // 追加のブロックを別途追加
    const additionalBlocks = [
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "追加したブロック" } }]
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
                content: "これらのブロックは、ページ作成後に追加されました。" 
              } 
            }
          ]
        }
      },
      {
        object: "block",
        type: "callout",
        callout: {
          rich_text: [{ type: "text", text: { content: "重要な情報はこのように表示できます" } }],
          icon: {
            emoji: "💡"
          }
        }
      },
      {
        object: "block",
        type: "quote",
        quote: {
          rich_text: [{ type: "text", text: { content: "引用文はこのように表示されます" } }]
        }
      },
      {
        object: "block",
        type: "to_do",
        to_do: {
          rich_text: [{ type: "text", text: { content: "タスク1" } }],
          checked: false
        }
      },
      {
        object: "block",
        type: "to_do",
        to_do: {
          rich_text: [{ type: "text", text: { content: "タスク2" } }],
          checked: true
        }
      }
    ];
    
    console.log('追加のブロックを追加中...');
    await appendBlocksToPage(newPage.id, additionalBlocks);
    console.log('追加のブロックを追加しました');
    
    // 複数ページを一括作成する例
    console.log('複数ページを一括作成中...');
    
    for (let i = 1; i <= 3; i++) {
      // 各ページのプロパティをコピー
      const pageProperties = { ...newPageProperties };
      
      // タイトルを変更
      if (titleProperty) {
        pageProperties[titleProperty] = {
          title: [{ text: { content: `一括作成ページ #${i}` } }]
        };
      }
      
      // シンプルなコンテンツのみ追加
      const simpleContent = [
        {
          object: "block",
          type: "heading_1",
          heading_1: {
            rich_text: [{ type: "text", text: { content: `一括作成されたページ #${i}` } }]
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
                  content: `これは一括作成シリーズの${i}番目のページです。` 
                } 
              }
            ]
          }
        }
      ];
      
      // ページ作成
      const batchPage = await createPage(NOTION_DATABASE_ID, pageProperties, simpleContent);
      console.log(`一括ページ #${i} を作成しました: ${batchPage.url}`);
    }
    
    console.log('すべての処理が完了しました！');
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

// メイン関数を実行
main();