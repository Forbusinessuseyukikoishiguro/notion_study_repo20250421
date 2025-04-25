// simpleNotionTaskFilter.js
// シンプルなNotionタスク管理・日付フィルター

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

// Notion API設定
// .envファイルに以下を設定：
// NOTION_KEY=your_integration_token
// NOTION_DATABASE_ID=your_database_id
const NOTION_KEY = process.env.NOTION_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
const NOTION_API_BASE = 'https://api.notion.com/v1';

// APIクライアント設定
const notion = axios.create({
  baseURL: NOTION_API_BASE,
  headers: {
    'Authorization': `Bearer ${NOTION_KEY}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28'
  }
});

// エラーハンドリング関数
function handleError(error) {
  if (error.response) {
    console.error('エラー:', {
      status: error.response.status,
      data: error.response.data
    });
  } else if (error.request) {
    console.error('レスポンスなし:', error.request);
  } else {
    console.error('エラー:', error.message);
  }
}

// データベースプロパティを取得
async function getDatabaseProperties() {
  try {
    const response = await notion.get(`/databases/${NOTION_DATABASE_ID}`);
    return response.data.properties;
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// 基本クエリ関数
async function queryDatabase(filter = null, sorts = null) {
  try {
    const queryParams = {};
    if (filter) queryParams.filter = filter;
    if (sorts) queryParams.sorts = sorts;
    
    const response = await notion.post(`/databases/${NOTION_DATABASE_ID}/query`, queryParams);
    return response.data.results;
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// 未完了タスクを取得
async function getIncompleteTasks() {
  try {
    // データベースプロパティ取得
    const dbProps = await getDatabaseProperties();
    
    // 完了フラグのプロパティ特定
    const checkboxProp = Object.keys(dbProps).find(
      key => dbProps[key].type === 'checkbox' && 
        (key.toLowerCase().includes('完了') || 
         key.toLowerCase().includes('done') || 
         key.toLowerCase().includes('complete'))
    );
    
    if (!checkboxProp) {
      throw new Error('完了フラグのチェックボックスプロパティが見つかりません');
    }
    
    // 未完了タスクをフィルタリング
    const filter = {
      property: checkboxProp,
      checkbox: {
        equals: false
      }
    };
    
    const results = await queryDatabase(filter);
    return formatResults(results, dbProps);
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// 期限が近いタスクを取得
async function getUpcomingTasks(days = 7) {
  try {
    // データベースプロパティ取得
    const dbProps = await getDatabaseProperties();
    
    // 日付プロパティ特定
    const dateProp = Object.keys(dbProps).find(
      key => dbProps[key].type === 'date' && 
        (key.toLowerCase().includes('期限') || 
         key.toLowerCase().includes('due') || 
         key.toLowerCase().includes('date') || 
         key.toLowerCase().includes('deadline'))
    );
    
    if (!dateProp) {
      throw new Error('期限の日付プロパティが見つかりません');
    }
    
    // 今日の日付
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // n日後の日付
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);
    const futureDateStr = futureDate.toISOString().split('T')[0];
    
    // 期限が近いタスクをフィルタリング
    const filter = {
      and: [
        {
          property: dateProp,
          date: {
            on_or_after: todayStr
          }
        },
        {
          property: dateProp,
          date: {
            on_or_before: futureDateStr
          }
        }
      ]
    };
    
    const results = await queryDatabase(filter);
    return formatResults(results, dbProps);
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// 期限切れタスクを取得
async function getOverdueTasks() {
  try {
    // データベースプロパティ取得
    const dbProps = await getDatabaseProperties();
    
    // 日付プロパティ特定
    const dateProp = Object.keys(dbProps).find(
      key => dbProps[key].type === 'date' && 
        (key.toLowerCase().includes('期限') || 
         key.toLowerCase().includes('due') || 
         key.toLowerCase().includes('date') || 
         key.toLowerCase().includes('deadline'))
    );
    
    // 完了フラグのプロパティ特定
    const checkboxProp = Object.keys(dbProps).find(
      key => dbProps[key].type === 'checkbox' && 
        (key.toLowerCase().includes('完了') || 
         key.toLowerCase().includes('done') || 
         key.toLowerCase().includes('complete'))
    );
    
    if (!dateProp) {
      throw new Error('期限の日付プロパティが見つかりません');
    }
    
    // 今日の日付
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // フィルター作成
    let conditions = [
      {
        property: dateProp,
        date: {
          before: todayStr
        }
      }
    ];
    
    // 完了フラグがある場合は追加
    if (checkboxProp) {
      conditions.push({
        property: checkboxProp,
        checkbox: {
          equals: false
        }
      });
    }
    
    const filter = {
      and: conditions
    };
    
    const results = await queryDatabase(filter);
    return formatResults(results, dbProps);
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// 日付範囲で検索
async function searchByDateRange(startDate, endDate) {
  try {
    // データベースプロパティ取得
    const dbProps = await getDatabaseProperties();
    
    // 日付プロパティ特定
    const dateProp = Object.keys(dbProps).find(
      key => dbProps[key].type === 'date' && 
        (key.toLowerCase().includes('期限') || 
         key.toLowerCase().includes('due') || 
         key.toLowerCase().includes('date') || 
         key.toLowerCase().includes('deadline'))
    );
    
    if (!dateProp) {
      throw new Error('日付プロパティが見つかりません');
    }
    
    // 日付範囲フィルター
    const filter = {
      property: dateProp,
      date: {}
    };
    
    if (startDate) {
      filter.date.on_or_after = startDate;
    }
    
    if (endDate) {
      filter.date.on_or_before = endDate;
    }
    
    const results = await queryDatabase(filter);
    return formatResults(results, dbProps);
  } catch (error) {
    handleError(error);
    throw error;
  }
}

// 結果を整形
function formatResults(results, dbProps) {
  const formattedResults = [];
  
  // タイトルプロパティ特定
  const titleProp = Object.keys(dbProps).find(
    key => dbProps[key].type === 'title'
  );
  
  // 日付プロパティ特定
  const dateProp = Object.keys(dbProps).find(
    key => dbProps[key].type === 'date' && 
      (key.toLowerCase().includes('期限') || 
       key.toLowerCase().includes('due') || 
       key.toLowerCase().includes('date') || 
       key.toLowerCase().includes('deadline'))
  );
  
  // 完了フラグのプロパティ特定
  const checkboxProp = Object.keys(dbProps).find(
    key => dbProps[key].type === 'checkbox' && 
      (key.toLowerCase().includes('完了') || 
       key.toLowerCase().includes('done') || 
       key.toLowerCase().includes('complete'))
  );
  
  // 結果整形
  for (const page of results) {
    const item = {
      id: page.id,
      url: page.url
    };
    
    // タイトル取得
    if (titleProp && page.properties[titleProp].title.length > 0) {
      item.title = page.properties[titleProp].title.map(t => t.plain_text).join('');
    } else {
      item.title = '無題';
    }
    
    // 日付取得
    if (dateProp && page.properties[dateProp].date) {
      item.date = page.properties[dateProp].date.start;
    }
    
    // 完了フラグ取得
    if (checkboxProp) {
      item.completed = page.properties[checkboxProp].checkbox;
    }
    
    formattedResults.push(item);
  }
  
  return formattedResults;
}

// 結果を表示
function displayResults(results) {
  if (results.length === 0) {
    console.log('条件に一致するタスクはありません。');
    return;
  }
  
  console.log(`${results.length}件のタスクが見つかりました:\n`);
  
  results.forEach((task, index) => {
    console.log(`${index + 1}. ${task.title}`);
    if (task.date) {
      console.log(`   期限: ${task.date}`);
    }
    if (task.completed !== undefined) {
      console.log(`   完了: ${task.completed ? 'はい' : 'いいえ'}`);
    }
    console.log(`   URL: ${task.url}`);
    console.log('');
  });
}

// CSVにエクスポート
function exportToCsv(results, filename = 'tasks.csv') {
  const headers = ['タイトル', '期限', '完了', 'URL'];
  
  const rows = [
    headers.join(',')
  ];
  
  for (const task of results) {
    const values = [
      `"${task.title.replace(/"/g, '""')}"`,
      task.date ? `"${task.date}"` : '',
      task.completed !== undefined ? `"${task.completed ? 'はい' : 'いいえ'}"` : '',
      `"${task.url}"`
    ];
    
    rows.push(values.join(','));
  }
  
  fs.writeFileSync(filename, rows.join('\n'));
  console.log(`結果を ${filename} にエクスポートしました。`);
}

// メインコマンドライン実行関数
async function main() {
  if (process.argv.length <= 2) {
    console.log('使用方法:');
    console.log('- 未完了タスク: node simpleNotionTaskFilter.js incomplete');
    console.log('- 期限が近いタスク: node simpleNotionTaskFilter.js upcoming [日数]');
    console.log('- 期限切れタスク: node simpleNotionTaskFilter.js overdue');
    console.log('- 日付範囲検索: node simpleNotionTaskFilter.js daterange [開始日] [終了日]');
    return;
  }
  
  const command = process.argv[2];
  let results = [];
  
  try {
    switch (command) {
      case 'incomplete':
        console.log('未完了タスクを取得中...');
        results = await getIncompleteTasks();
        break;
        
      case 'upcoming':
        const days = process.argv[3] ? parseInt(process.argv[3]) : 7;
        console.log(`期限が${days}日以内のタスクを取得中...`);
        results = await getUpcomingTasks(days);
        break;
        
      case 'overdue':
        console.log('期限切れタスクを取得中...');
        results = await getOverdueTasks();
        break;
        
      case 'daterange':
        const startDate = process.argv[3] || '';
        const endDate = process.argv[4] || '';
        console.log(`日付範囲検索: ${startDate || '(開始日なし)'} から ${endDate || '(終了日なし)'}`);
        results = await searchByDateRange(startDate, endDate);
        break;
        
      default:
        console.log('無効なコマンドです。');
        return;
    }
    
    displayResults(results);
    
    if (results.length > 0) {
      exportToCsv(results, `notion_${command}_${new Date().toISOString().split('T')[0]}.csv`);
    }
    
  } catch (error) {
    console.error('エラーが発生しました:', error.message);
  }
}

// プログラム実行
if (require.main === module) {
  main().catch(console.error);
}

// モジュールとしてエクスポート
module.exports = {
  getIncompleteTasks,
  getUpcomingTasks,
  getOverdueTasks,
  searchByDateRange,
  displayResults,
  exportToCsv
};