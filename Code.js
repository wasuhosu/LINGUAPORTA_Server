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
  const questionTypes = payload.question_type;
  if (!questionNumbers || !Array.isArray(questionNumbers) || !questionTypes || !Array.isArray(questionTypes) || questionNumbers.length !== questionTypes.length) {
    return { status: "error", message: "Invalid or missing question_number/question_type array or length mismatch" };
  }

  const wordMeaningSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(WORD_MEANING_SHEET_NAME);
  const fillBlankSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(FILL_BLANK_SHEET_NAME);
  if (!wordMeaningSheet || !fillBlankSheet) {
    return { status: "error", message: "Required sheets not found. Please create sheets: '単語の意味' and '空所補充'" };
  }

  const results = [];
  for (let i = 0; i < questionNumbers.length; i++) {
    const questionNum = questionNumbers[i];
    const questionType = questionTypes[i];
    const rowIndex = questionNum + 1;
    try {
      if (questionType === "単語の意味") {
        const range = wordMeaningSheet.getRange(rowIndex, 1, 1, 4);
        const rowData = range.getValues()[0];
        if (rowData[1] === questionNum) {
          results.push(rowData);
        }
      } else if (questionType === "空所補充") {
        const range = fillBlankSheet.getRange(rowIndex, 1, 1, 4);
        const rowData = range.getValues()[0];
        if (rowData[1] === questionNum) {
          results.push(rowData);
        }
      } else {
        // 無効なタイプはスキップ
        console.log(`Skipped question ${questionNum} with type "${questionType}" - invalid type`);
      }
    } catch (error) {
      console.log(`Error retrieving question ${questionNum} with type ${questionType}: ${error.message}`);
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




