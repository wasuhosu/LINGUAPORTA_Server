// Google Apps Script (GAS) Code
// This script is assumed to be deployed as a web app.
// It interacts with a Google Spreadsheet to store and retrieve data for the LINGUAPORTA extension.

// --- Configuration ---
// Replace with your Google Spreadsheet ID
const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID"; 

// Sheet names
const DB_SHEET_NAME = "QuestionDB";

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

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DB_SHEET_NAME);
  if (!sheet) {
    return { status: "error", message: `Sheet "${DB_SHEET_NAME}" not found.` };
  }
  
  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const questionNumberColIndex = header.indexOf("question_number");

  const results = [];
  const questionSet = new Set(questionNumbers);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const qNum = row[questionNumberColIndex];
    if (questionSet.has(qNum)) {
      results.push(row);
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

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DB_SHEET_NAME);
  if (!sheet) {
    return { status: "error", message: `Sheet "${DB_SHEET_NAME}" not found.` };
  }

  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const questionNumberColIndex = header.indexOf("question_number");
  
  const existingQuestionNumbers = new Set(data.slice(1).map(row => row[questionNumberColIndex]));

  const rowsToAdd = [];
  content.forEach(item => {
    if (!existingQuestionNumbers.has(item.question_number)) {
      // Assuming the order of columns in the sheet matches the object properties
      const newRow = [
        new Date(), // timestamp
        item.question_number,
        item.question_type,
        item.question_answer_1,
        item.question_answer_2,
        null, // Placeholder for other columns if any
        null
      ];
      rowsToAdd.push(newRow);
      existingQuestionNumbers.add(item.question_number); // Avoid duplicates in the same batch
    }
  });

  if (rowsToAdd.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
  }

  return { status: "success", message: `${rowsToAdd.length} new questions added.` };
}




