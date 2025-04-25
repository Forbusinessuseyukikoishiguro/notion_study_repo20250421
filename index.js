require('dotenv').config();
const axios = require('axios');

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
async function queryDatabase() {
  try {
    const response = await notion.post(`/databases/${NOTION_DATABASE_ID}/query`);
    return response.data;
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// 期限切れとステータス件数を集計する関数
async function countTasks() {
  try {
    console.log('データベースをクエリ中...');
    const data = await queryDatabase();

    const today = new Date().toISOString().split('T')[0];
    let overdueCount = 0;
    const statusCounts = {};

    data.results.forEach(task => {
      const properties = task.properties;

      // デバッグ: プロパティの内容を確認
      console.log('タスクプロパティ:', properties);

      // 期限切れタスクをカウント
      if (properties['due date'] && properties['due date'].date) {
        const dueDate = properties['due date'].date.start;
        if (dueDate && dueDate < today) {
          overdueCount++;
        }
      }

      // ステータスごとの件数を集計
      if (properties['ステータス'] && properties['ステータス'].status) {
        const status = properties['ステータス'].status.name; // ステータス名を取得
        if (!statusCounts[status]) {
          statusCounts[status] = 0;
        }
        statusCounts[status]++;
      }
    });

    // 結果をターミナルに出力
    console.log(`期限切れタスク: ${overdueCount}件`);
    console.log('ステータスごとの件数:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`- ${status}: ${count}件`);
    });

    // 総合計を計算して出力
    const totalTasks = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    console.log(`タスクの総合計: ${totalTasks}件`);
  } catch (error) {
    console.error('タスク集計中にエラーが発生しました:', error);
  }
}

// 実行
countTasks();

