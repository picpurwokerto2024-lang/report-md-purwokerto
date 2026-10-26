/**
 * REPORT MD PURWOKERTO — CMS V2 + REALTIME SYNC, HERO SLIDER & LOGO
 * Google Apps Script Web App
 *
 * Cara Setup:
 * 1. Buka spreadsheet Google Sheets Anda.
 * 2. Klik menu Ekstensi > Apps Script.
 * 3. Hapus semua kode lama dan tempel seluruh isi file ini.
 * 4. Klik Deploy > Manage deployments > Edit (pensil) > New version > Deploy.
 */

const DEFAULT_PIN = '123456';

/**
 * OPSIONAL: Isi di sini jika script dibuat mandiri (bukan dari Ekstensi > Apps Script di Google Sheets).
 * Jika script dibuka langsung dari menu Ekstensi Google Sheets, biarkan kosong karena otomatis terhubung.
 */
const SPREADSHEET_ID_TETAP = '';

function getSS_() {
  // 1. Otomatis hubungkan jika script dibuka dari menu Ekstensi > Apps Script di Google Sheets
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active && active.getId()) return active;
  } catch (e) {}

  // 2. Hubungkan jika SPREADSHEET_ID_TETAP diisi ID spreadsheet
  const tetap = String(SPREADSHEET_ID_TETAP || '').trim();
  if (tetap && tetap.indexOf('PASTE_') !== 0 && tetap.length > 10) {
    try {
      return SpreadsheetApp.openById(tetap);
    } catch (e) {}
  }

  // 3. Hubungkan dari Script Properties
  const propId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (propId && propId.length > 10) {
    try {
      return SpreadsheetApp.openById(propId);
    } catch (e) {}
  }

  // 4. Jika belum ada spreadsheet sama sekali, buat otomatis di Google Drive Anda
  try {
    const newSS = SpreadsheetApp.create('Report MD Purwokerto - CMS Database');
    const newId = newSS.getId();
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', newId);
    return newSS;
  } catch (e) {
    throw new Error('Gagal menghubungkan spreadsheet. Buka script ini langsung dari Google Sheets (menu Ekstensi > Apps Script).');
  }
}

/**
 * Tes koneksi: jalankan fungsi ini untuk cek status spreadsheet di Log eksekusi
 */
function tesKoneksi() {
  const ss = getSS_();
  const menus = ss.getSheetByName('Menus');
  const count = menus ? Math.max(0, menus.getLastRow() - 1) : 0;
  console.log('BERHASIL terhubung ke spreadsheet: ' + ss.getName() + ' (ID: ' + ss.getId() + ') | jumlah menu: ' + count);
}

function json_(obj, callback) {
  if (callback && typeof callback === 'string' && /^[a-zA-Z0-9_$.]+$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(obj) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * GET ?action=public -> Mengembalikan data realtime untuk seluruh pengguna (Mendukung Fetch CORS & JSONP Seluler)
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'public') {
    const callback = e.parameter.callback || e.parameter.prefix || '';
    try {
      const ss = getSS_();
      const menus = readMenus_(ss).filter(m => String(m.status).toUpperCase() === 'AKTIF');
      const settings = readSettings_(ss);
      return json_({
        ok: true,
        menus: menus,
        settings: settings,
        updatedAt: new Date().toISOString()
      }, callback);
    } catch (err) {
      return json_({ ok: false, message: err.message }, callback);
    }
  }

  return HtmlService.createTemplateFromFile('Admin')
    .evaluate()
    .setTitle('CMS Report MD Purwokerto')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * POST -> Menyimpan perubahan dari Admin agar tersinkron ke semua pengguna
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, message: 'Data request kosong.' });
    }
    const req = JSON.parse(e.postData.contents);
    let data;
    if (req.action === 'getState')       data = getState(req.pin);
    else if (req.action === 'saveState') data = saveState(req.pin, req.state);
    else if (req.action === 'changePin') data = changePin(req.pin, req.newPin);
    else throw new Error('Aksi tidak dikenal: ' + req.action);

    return json_({ ok: true, data: data });
  } catch (err) {
    return json_({ ok: false, message: err.message });
  }
}

function getState(pin) {
  auth_(pin);
  const ss = getSS_();
  const menus = readMenus_(ss);
  const settings = readSettings_(ss);
  return { menus: menus, settings: settings, spreadsheetId: ss.getId() };
}

function saveState(pin, payload) {
  auth_(pin);
  const ss = getSS_();
  if (!payload) return { ok: true };

  // 1. Simpan Data Menus (Hanya jika payload.menus disediakan dan berupa array)
  if (Array.isArray(payload.menus) && payload.menus.length > 0) {
    let menusSheet = ss.getSheetByName('Menus');
    if (!menusSheet) menusSheet = ss.insertSheet('Menus');
    menusSheet.clear();
    ensureCols_(menusSheet, 7);
    menusSheet.getRange(1, 1, 1, 7).setValues([['Nama', 'Link', 'Status', 'Urutan', 'Deskripsi', 'Warna', 'FotoUrl']]);

    const menuRows = payload.menus.map((x, i) => [
      String(x.nama || '').trim(),
      String(x.link || '').trim(),
      String(x.status || 'AKTIF').toUpperCase(),
      Number(x.urutan || i + 1),
      String(x.deskripsi || '').trim(),
      cleanColor_(x.warna),
      truncateCell_(x.fotoUrl || '')
    ]);
    if (menuRows.length > 0) {
      menusSheet.getRange(2, 1, menuRows.length, 7).setValues(menuRows);
    }
    menusSheet.setFrozenRows(1);
  }

  // 2. Simpan Data Settings, Banner & Logo (Hanya jika payload.settings disediakan)
  if (payload.settings && typeof payload.settings === 'object') {
    let settingsSheet = ss.getSheetByName('Settings');
    if (!settingsSheet) settingsSheet = ss.insertSheet('Settings');
    settingsSheet.clear();
    settingsSheet.getRange(1, 1, 1, 2).setValues([['Key', 'Value']]);

    const st = payload.settings;
    const logoRaw = String(st.logoUrl || '').trim();
    const logoPart1 = logoRaw.substring(0, 45000);
    const logoPart2 = logoRaw.substring(45000, 90000);
    const logoPart3 = logoRaw.substring(90000, 135000);

    const settingRows = [
      ['title', truncateCell_(st.title || 'REPORT MD PURWOKERTO')],
      ['subtitle', truncateCell_(st.subtitle || 'KAO Peduli Inovasi')],
      ['searchPlaceholder', truncateCell_(st.searchPlaceholder || 'Cari menu atau nama MD...')],
      ['warna1', cleanColor_(st.warna1)],
      ['warna2', cleanColor_(st.warna2)],
      ['bannerAutoSlideInterval', String(st.bannerAutoSlideInterval || 4)],
      ['banners', truncateCell_(JSON.stringify(st.banners || []))],
      ['logoUrl', logoPart1],
      ['logoUrl_part2', logoPart2],
      ['logoUrl_part3', logoPart3],
      ['logoText', truncateCell_(st.logoText || 'BTB')],
      ['watermarkText', truncateCell_(st.watermarkText || 'Powered by Intisari')],
      ['watermarkEnabled', st.watermarkEnabled === false ? 'false' : 'true'],
      ['watermarkLink', truncateCell_(st.watermarkLink || '')],
      ['updatedAt', new Date().toISOString()]
    ];
    settingsSheet.getRange(2, 1, settingRows.length, 2).setValues(settingRows);
    settingsSheet.setFrozenRows(1);

    // 3. Simpan Banners ke Sheet Terpisah (Mencegah Limit 50.000 Karakter Google Sheets, Mendukung Gambar HD)
    if (Array.isArray(st.banners)) {
      let bannersSheet = ss.getSheetByName('Banners');
      const bannerHeaders = [[
        'id',
        'imageUrl',
        'title',
        'subtitle',
        'scriptText',
        'badgeText',
        'imageUrl_part2',
        'imageUrl_part3',
        'hideOverlay',
        'fitMode',
        'imageUrl_part4'
      ]];
      if (st.banners.length > 0) {
        if (!bannersSheet) bannersSheet = ss.insertSheet('Banners');
        bannersSheet.clear();
        bannersSheet.getRange(1, 1, 1, 11).setValues(bannerHeaders);

        const bannerRows = st.banners.map((b, idx) => {
          const imgRaw = String(b.imageUrl || '').trim();
          const p1 = imgRaw.substring(0, 45000);
          const p2 = imgRaw.substring(45000, 90000);
          const p3 = imgRaw.substring(90000, 135000);
          const p4 = imgRaw.substring(135000, 180000);
          return [
            String(b.id || ('banner-' + (idx + 1))),
            p1,
            truncateCell_(b.title || ''),
            truncateCell_(b.subtitle || ''),
            truncateCell_(b.scriptText || ''),
            truncateCell_(b.badgeText || ''),
            p2,
            p3,
            b.hideOverlay ? 'true' : 'false',
            b.fitMode === 'cover' ? 'cover' : 'contain',
            p4
          ];
        });
        bannersSheet.getRange(2, 1, bannerRows.length, 11).setValues(bannerRows);
        bannersSheet.setFrozenRows(1);
      } else if (bannersSheet) {
        bannersSheet.clear();
        bannersSheet.getRange(1, 1, 1, 11).setValues(bannerHeaders);
        bannersSheet.setFrozenRows(1);
      }
    }
  }

  return { ok: true, message: 'Data berhasil disinkronkan ke seluruh pengguna.', savedAt: new Date().toISOString() };
}

function changePin(oldPin, newPin) {
  auth_(oldPin);
  if (!newPin || String(newPin).length < 4) throw new Error('PIN minimal 4 digit.');
  PropertiesService.getScriptProperties().setProperty('ADMIN_PIN', String(newPin).trim());
  return 'PIN berhasil diubah.';
}

function readMenus_(ss) {
  const sh = ss.getSheetByName('Menus');
  if (!sh || sh.getLastRow() < 2) return [];
  const numCols = Math.max(sh.getLastColumn(), 7);
  ensureCols_(sh, numCols);
  return sh.getRange(2, 1, sh.getLastRow() - 1, numCols).getValues().map((r, i) => ({
    nama: r[0],
    link: r[1],
    status: r[2] || 'AKTIF',
    urutan: r[3] || i + 1,
    deskripsi: r[4] || '',
    warna: cleanColor_(r[5]),
    fotoUrl: r[6] ? String(r[6]).trim() : ''
  }));
}

function readBanners_(ss) {
  const sh = ss.getSheetByName('Banners');
  if (!sh || sh.getLastRow() < 2) return null;
  ensureCols_(sh, 11);
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 11).getValues();
  const list = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    let img = String(r[1] || '').trim();
    if (r[6]) img += String(r[6]).trim();
    if (r[7]) img += String(r[7]).trim();
    if (r[10]) img += String(r[10]).trim();
    if (!img) continue;
    const rawFit = String(r[9] || '').trim();
    list.push({
      id: String(r[0] || ('banner-' + (i + 1))),
      imageUrl: img,
      title: String(r[2] || ''),
      subtitle: String(r[3] || ''),
      scriptText: String(r[4] || ''),
      badgeText: String(r[5] || ''),
      hideOverlay: String(r[8] || '') === 'true',
      fitMode: rawFit === 'cover' ? 'cover' : 'contain'
    });
  }
  return list.length > 0 ? list : null;
}

function readSettings_(ss) {
  const sh = ss.getSheetByName('Settings');
  const out = {};
  if (!sh || sh.getLastRow() < 2) return out;

  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(r => {
    out[String(r[0])] = String(r[1] ?? '');
  });

  // Gabungkan kembali potongan logo jika disimpan multi-chunk
  if (out.logoUrl_part2) {
    out.logoUrl = (out.logoUrl || '') + out.logoUrl_part2;
    delete out.logoUrl_part2;
  }
  if (out.logoUrl_part3) {
    out.logoUrl = (out.logoUrl || '') + out.logoUrl_part3;
    delete out.logoUrl_part3;
  }

  // Baca banner dari sheet khusus Banners terlebih dahulu jika tersedia
  const separateBanners = readBanners_(ss);
  if (separateBanners) {
    out.banners = separateBanners;
  } else if (out.banners) {
    try {
      out.banners = JSON.parse(out.banners);
    } catch (e) {
      out.banners = [];
    }
  } else {
    out.banners = [];
  }

  // Pengaturan Watermark
  if (out.watermarkEnabled !== undefined) {
    out.watermarkEnabled = String(out.watermarkEnabled).toLowerCase() !== 'false';
  } else {
    out.watermarkEnabled = true;
  }
  if (!out.watermarkText) {
    out.watermarkText = 'Powered by Intisari';
  }

  return out;
}

function auth_(pin) {
  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperty('ADMIN_PIN') || DEFAULT_PIN;
  const inputPin = String(pin || '').trim();
  if (inputPin !== stored) {
    throw new Error('PIN admin salah.');
  }
}

function ensureCols_(sh, n) {
  const have = sh.getMaxColumns();
  if (have < n) sh.insertColumnsAfter(have, n - have);
}

function cleanColor_(v) {
  const s = String(v || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : '';
}

function truncateCell_(val) {
  const s = String(val ?? '');
  return s.length > 48000 ? s.substring(0, 48000) : s;
}
