// =====================================================================
// KONFIGURASI TARGET SPREADSHEET & GOOGLE DRIVE (SUDAH TERISI)
// =====================================================================
const SPREADSHEET_ID = "nHTSr7_4zdZczc8NF-9dcwuwQ1C_w9r4zN3tPjdipEE";
const NAMA_SHEET = "Rekap Presensi";

const FOLDER_DRIVE_ID = "1y-JereVslGzXFM8i639BjqMeCGeq0kWw";
const NAMA_FOLDER_DRIVE = "Foto Presensi Guru - SD Plus Darussalam";

function getTargetSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
    return SpreadsheetApp.openById(SPREADSHEET_ID.trim());
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getTargetFolder() {
  if (FOLDER_DRIVE_ID && FOLDER_DRIVE_ID.trim() !== "") {
    return DriveApp.getFolderById(FOLDER_DRIVE_ID.trim());
  }
  const folders = DriveApp.getFoldersByName(NAMA_FOLDER_DRIVE);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(NAMA_FOLDER_DRIVE);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ status: "error", message: "Payload kosong." });
    }

    const data = JSON.parse(e.postData.contents);

    // 1. Buka Google Spreadsheet target & siapkan sheet
    const ss = getTargetSpreadsheet();
    let sheet = ss.getSheetByName(NAMA_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(NAMA_SHEET);
    }

    const expectedHeaders = [
      "Timestamp Server",
      "Nama Guru",
      "Jenis Presensi",
      "Tanggal",
      "Jam",
      "Latitude",
      "Longitude",
      "Alamat Lokasi",
      "Link Foto Drive"
    ];

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(expectedHeaders);
      sheet.setFrozenRows(1);
    }

    // 2. Buka Folder Google Drive target & simpan foto terkompres (JPEG)
    let fotoUrl = "-";
    if (data.fotoBase64) {
      const folder = getTargetFolder();
      const base64Clean = data.fotoBase64.replace(/^data:image\/\w+;base64,/, "");
      const bytes = Utilities.base64Decode(base64Clean);
      const safeNama = String(data.nama || "Guru").replace(/[^a-zA-Z0-9_-]/g, "_");
      const fileName = `${data.isoDate || "tgl"}_${safeNama}_${data.jenis || "Absen"}.jpg`;

      const blob = Utilities.newBlob(bytes, "image/jpeg", fileName);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fotoUrl = file.getUrl();
    }

    // 3. Tambahkan baris data absensi ke Spreadsheet
    sheet.appendRow([
      new Date(),
      data.nama || "-",
      data.jenis || "-",
      data.tanggal || "-",
      data.jam || "-",
      data.latitude ?? "-",
      data.longitude ?? "-",
      data.alamat || "-",
      fotoUrl
    ]);

    return jsonResponse({
      status: "ok",
      message: "Data tersimpan ke Spreadsheet dan Google Drive.",
      fotoUrl: fotoUrl
    });
  } catch (err) {
    return jsonResponse({
      status: "error",
      message: err.message
    });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}