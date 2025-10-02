// Google Apps Script (GAS) Code
// This script is assumed to be deployed as a web app.
// It interacts with a Google Spreadsheet to store and retrieve data for the LINGUAPORTA extension.

// --- Configuration ---
// Replace with your Google Spreadsheet ID
const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID"; 

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
  if (!questionNumbers || !Array.isArray(questionNumbers)) {
    return { status: "error", message: "Invalid or missing question_number array" };
  }

  // 両シートからデータを取得
  const wordMeaningSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(WORD_MEANING_SHEET_NAME);
  const fillBlankSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(FILL_BLANK_SHEET_NAME);
  
  if (!wordMeaningSheet || !fillBlankSheet) {
    return { status: "error", message: "Required sheets not found. Please create sheets: '単語の意味' and '空所補充'" };
  }

  const results = [];
  
  // 各問題番号について対応するシートから固定行でデータを取得
  for (const questionNum of questionNumbers) {
    // 問題番号1-2600に対応する行番号（2行目から開始、1行目はヘッダー）
    const rowIndex = questionNum + 1;
    
    // 単語の意味シート（問題1-1300）
    if (questionNum >= 1 && questionNum <= 1300) {
      try {
        const range = wordMeaningSheet.getRange(rowIndex, 1, 1, 7); // A列からG列まで
        const rowData = range.getValues()[0];
        // データが存在する場合のみ結果に追加（問題番号が一致する場合）
        if (rowData[1] === questionNum) { // B列に問題番号が格納されている
          results.push(rowData);
        }
      } catch (error) {
        // 行が存在しない場合やエラーの場合はスキップ
        console.log(`Error retrieving question ${questionNum} from word meaning sheet: ${error.message}`);
      }
    }
    // 空所補充シート（問題1301-2600）
    else if (questionNum >= 1301 && questionNum <= 2600) {
      try {
        // 空所補充の場合は問題番号から1300を引いた値を行番号として使用
        const adjustedRowIndex = questionNum - 1300 + 1;
        const range = fillBlankSheet.getRange(adjustedRowIndex, 1, 1, 7);
        const rowData = range.getValues()[0];
        if (rowData[1] === questionNum) {
          results.push(rowData);
        }
      } catch (error) {
        console.log(`Error retrieving question ${questionNum} from fill blank sheet: ${error.message}`);
      }
    }
  }

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
          wordMeaningSheet.getRange(rowIndex, 1, 1, 7).setValues([newRow]);
          updatedCount++;
        }
      }
      else if (questionType === "空所補充") {
        // 空所補充の場合は問題番号から1300を引いた値を行番号として使用
        const rowIndex = questionNum + 1;
        const existingQuestionNum = fillBlankSheet.getRange(rowIndex, 2).getValue();
        
        if (!existingQuestionNum || existingQuestionNum !== questionNum) {
          fillBlankSheet.getRange(rowIndex, 1, 1, 7).setValues([newRow]);
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




