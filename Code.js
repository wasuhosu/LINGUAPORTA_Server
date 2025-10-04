// Google Apps Script (GAS) Code
// This script is assumed to be deployed as a web app.
// It interacts with a Google Spreadsheet to store and retrieve data for the LINGUAPORTA extension.

// --- Configuration ---
// Replace with your Google Spreadsheet ID
const SPREADSHEET_ID = "<YOUR_SPREADSHEET_ID>"; 

// Sheet names
const WORD_MEANING_SHEET_NAME = "単語の意味";
const FILL_BLANK_SHEET_NAME = "空所補充";

/**
 * Handles POST requests from the Chrome extension's background script.
 * This is the main entry point for the web app.
 * @param {Object} e - The event parameter containing the POST request data.
 * @returns {ContentService.TextOutput} - A JSON response.
 */
function doPost(e) {
  let response;
  try {
    const payload = JSON.parse(e.postData.contents);
    const requestType = payload.request_type;

    switch (requestType) {
      case "get":
        response = handleGetRequest(payload);
        break;
      case "set":
        response = handleSetRequest(payload);
        break;
      default:
        response = { status: "error", message: "Invalid request_type" };
        break;
    }
  } catch (error) {
    response = { status: "error", message: "An error occurred: " + error.message, stack: error.stack };
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handles retrieving question answers from the spreadsheet.
 * @param {Object} payload - The request payload.
 * @returns {Object} - The response object.
 */
function handleGetRequest(payload) {
  const questionNumbers = payload.question_number;
  const questionType = payload.question_type; // 配列から単一の文字列に変更
  if (!questionNumbers || !Array.isArray(questionNumbers) || !questionType || typeof questionType !== 'string') {
    return { status: "error", message: "Invalid or missing question_number array or question_type string" };
  }

  const wordMeaningSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(WORD_MEANING_SHEET_NAME);
  const fillBlankSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(FILL_BLANK_SHEET_NAME);
  if (!wordMeaningSheet || !fillBlankSheet) {
    return { status: "error", message: "Required sheets not found. Please create sheets: '単語の意味' and '空所補充'" };
  }

  let sheet;
  if (questionType === "単語の意味") {
    sheet = wordMeaningSheet;
  } else if (questionType === "空所補充") {
    sheet = fillBlankSheet;
  } else {
    return { status: "error", message: `Invalid question_type: ${questionType}` };
  }

  const results = [];
  const data = sheet.getDataRange().getValues(); // シート全体のデータを一度に取得

  // 問題番号をキーにしたデータマップを作成
  const dataMap = new Map();
  for (let i = 1; i < data.length; i++) { // 1行目はヘッダーなのでスキップ
    const row = data[i];
    const qNum = row[1]; // B列が問題番号
    if (qNum) {
      dataMap.set(qNum, row);
    }
  }

  // リクエストされた問題番号のデータを効率的に検索
  questionNumbers.forEach(questionNum => {
    if (dataMap.has(questionNum)) {
      const row = dataMap.get(questionNum);
      let formattedRow;
      if (questionType === "単語の意味") {
        // [questionNum, answer1, answer2, null, null, null]
        formattedRow = [row[1], row[2], row[3], null, null, null];
      } else { // 空所補充
        // [questionNum, null, null, answer1, null, null]
        formattedRow = [row[1], null, null, row[2], null, null];
      }
      results.push(formattedRow);
    }
  });

  return { status: "success", content: results };
}

/**
 * Handles setting (saving) new question answers to the spreadsheet.
 * @param {Object} payload - The request payload.
 * @returns {Object} - The response object.
 */
function handleSetRequest(payload) {
  const content = payload.content;
  if (!content || !Array.isArray(content)) {
    return { status: "error", message: "Invalid or missing content array" };
  }

  const wordMeaningSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(WORD_MEANING_SHEET_NAME);
  const fillBlankSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(FILL_BLANK_SHEET_NAME);
  
  if (!wordMeaningSheet || !fillBlankSheet) {
    return { status: "error", message: "Required sheets not found. Please create sheets: '単語の意味' and '空所補充'" };
  }

  let updatedCount = 0;
  
  content.forEach(item => {
    try {
      Logger.log(item);
      const questionNum = item.question_number;
      const questionType = item.question_type;
      
      // 新しいデータ行を作成
      const newRow = [
        new Date(), // A列: timestamp
        questionNum, // B列: question_number
        item.question_answer_1, // D列: question_answer_1
        item.question_answer_2, // E列: question_answer_2
      ];
      
      // 問題タイプに基づいてシートを選択し、固定行に保存
      if (questionType === "単語の意味") {
        const rowIndex = questionNum + 1; // 1行目はヘッダー、2行目から問題1
        // 既存データの確認（B列の問題番号をチェック）
        const existingQuestionNum = wordMeaningSheet.getRange(rowIndex, 2).getValue();
        
        // データが存在しないか、問題番号が異なる場合のみ更新
        if (!existingQuestionNum || existingQuestionNum !== questionNum) {
          wordMeaningSheet.getRange(rowIndex, 1, 1, 4).setValues([newRow]);
          updatedCount++;
        }
      }
      else if (questionType === "空所補充") {
        // 空所補充の場合は問題番号から1300を引いた値を行番号として使用
        const rowIndex = questionNum + 1;
        const existingQuestionNum = fillBlankSheet.getRange(rowIndex, 2).getValue();
        
        if (!existingQuestionNum || existingQuestionNum !== questionNum) {
          fillBlankSheet.getRange(rowIndex, 1, 1, 4).setValues([newRow]);
          updatedCount++;
        }
      }
      else {
        console.log(`Skipped question ${questionNum} with type "${questionType}" - out of range or invalid type`);
      }
    } catch (error) {
      console.log(`Error saving question ${item.question_number}: ${error.message}`);
    }
  });

  return { status: "success", message: `${updatedCount} questions updated.` };
}




