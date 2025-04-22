// Notionデータベースのフィルタリング - シンプル版
require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises;

// Notion API設定
const NOTION_KEY = process.env.NOTION_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
const NOTION_API_BASE = 'https://api.notion.com/v1';

// APIクライアント
const notion = axios.create({
  baseURL: NOTION_API_BASE,
  headers: {
    'Authorization': `Bearer ${NOTION_KEY}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28'
  }
});

// エラーハンドラー
function handleError(error) {
  console.error('エラー発生:', error.message);
  if (error.response) {
    console.error('API応答:', error.response.data);
  }
}

// データベースクエリ関数
async function queryDatabase(filter = null, sorts = null) {
  try {
    const requestBody = {};
    
    if (filter) requestBody.filter = filter;
    if (sorts) requestBody.sorts = sorts;
    
    console.log('リクエスト:', JSON.stringify(requestBody, null, 2));
    
    const response = await notion.post(
      `/databases/${NOTION_DATABASE_ID}/query`,
      requestBody
    );
    
    return response.data;
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// CSVエクスポート
async function exportToCSV(data, filename) {
  if (!data.results || data.results.length === 0) {
    console.log('データがありません');
    return;
  }
  
  // ヘッダー行作成
  const properties = Object.keys(data.results[0].properties);
  let csv = properties.join(',') + '\n';
  
  // データ行作成
  data.results.forEach(item => {
    const values = properties.map(prop => {
      const propData = item.properties[prop];
      let value = '';
      
      // プロパティタイプに基づいて値を抽出
      if (propData.type === 'title' && propData.title[0]) {
        value = propData.title[0].plain_text;
      } else if (propData.type === 'rich_text' && propData.rich_text[0]) {
        value = propData.rich_text[0].plain_text;
      } else if (propData.type === 'date' && propData.date) {
        value = propData.date.start;
      } else if (propData.type === 'select' && propData.select) {
        value = propData.select.name;
      }
      
      // カンマを含む場合はダブルクォートで囲む
      return value.includes(',') ? `"${value}"` : value;
    });
    
    csv += values.join(',') + '\n';
  });
  
  // BOM付きでファイル保存
  await fs.writeFile(filename, '\uFEFF' + csv, 'utf8');
  console.log(`${filename}にデータを保存しました`);
}

// メイン処理
async function main() {
  try {
    // 1. まずデータベースの詳細を取得
    console.log('データベース詳細を取得中...');
    const dbResponse = await notion.get(`/databases/${NOTION_DATABASE_ID}`);
    const dbDetails = dbResponse.data;
    
    // プロパティ情報を出力
    console.log('データベースプロパティ:');
    Object.entries(dbDetails.properties).forEach(([name, prop]) => {
      console.log(`- ${name} (${prop.type})`);
    });
    
    // 2. 全てのタスクを取得
    console.log('全タスクを取得中...');
    const allTasks = await queryDatabase();
    console.log(`${allTasks.results.length}件のタスクを取得しました`);
    await fs.writeFile('all-tasks.json', JSON.stringify(allTasks, null, 2));
    await exportToCSV(allTasks, 'all-tasks.csv');
    
    // 3. due dateでソート
    console.log('タスクをdue dateでソート中...');
    const sortedTasks = await queryDatabase(null, [
      {
        property: 'due date',
        direction: 'ascending'
      }
    ]);
    console.log(`${sortedTasks.results.length}件のタスクをソートしました`);
    await exportToCSV(sortedTasks, 'tasks-sorted.csv');
    
    // 4. 今後のタスクをフィルタリング
    console.log('今後のタスクをフィルタリング中...');
    const today = new Date().toISOString().split('T')[0];
    const upcomingTasks = await queryDatabase({
      property: 'due date',
      date: {
        on_or_after: today
      }
    });
    console.log(`${upcomingTasks.results.length}件の今後のタスクを取得しました`);
    await exportToCSV(upcomingTasks, 'upcoming-tasks.csv');
    
    console.log('処理完了');
  } catch (error) {
    console.error('実行エラー:', error);
  }
}

// 実行
main();