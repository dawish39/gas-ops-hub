/***********************
 *  郵件寄送模組
 ***********************/

/**
 * 寄送日報郵件
 * @param {string} prefix - 可選的主旨前綴（例如：'更新'）
 */
function sendReport(prefix) {
  const props = PropertiesService.getScriptProperties();
  const reportId = props.getProperty("LAST_REPORT_ID");

  const today = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyyMMdd");
  const todayFull = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy/MM/dd");
  
  // 讀取收件人設定
  const mailSettings = readMailSettings();

  if (reportId) {
    const file = DriveApp.getFileById(reportId);

    // 檢查檔名必須包含今天日期（避免寄到舊的報表）
    if (!file.getName().includes(todayFull)) {
      sendErrorEmail(
        mailSettings.to,
        `資訊部工作日報失敗 - ${today}`,
        `⚠️ 找到的報表不是今天的，請檢查產出流程。\n檔名：${file.getName()}`,
        `<p style="color:red;">⚠️ 找到的報表不是今天的，請檢查產出流程。<br>檔名：${file.getName()}</p>`
      );
      return;
    }

    // ========== 準備郵件主旨（支援前綴） ==========
    const subject = (prefix ? `[${prefix}] ` : '') + `資訊部工作日報 - ${today}`;
    // 自動寄送：資訊部工作日報 - 20251020
    // 手動寄送：[更新] 資訊部工作日報 - 20251020
    // ============================================

    const body =
      `哈囉！今日的資訊部工作日報已生成：\n\n` +
      `Google Docs 版本：\n${file.getUrl()}\n\n` +
      `附件 PDF 檔為上述內容之轉檔版本\n\n` +
      `※ 本信件由系統自動發送，請勿直接回覆。`;

    const htmlBody =
      `<div style="font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:1.6;">` +
      `<p>哈囉！今日的 <b style="color:#2E86C1;">資訊部工作日報</b> 已生成：</p>` +
      `<p><b style="color:#2E86C1;">Google Docs 版本：</b><br>` +
      `<a href="${file.getUrl()}" target="_blank" style="color:#1A5276;">${file.getUrl()}</a></p>` +
      `<p><b style="color:#D35400;">PDF 附件：</b> 已隨信附上，為上述內容之轉檔版本。</p>` +
      `<hr style="border:none; border-top:1px solid #ccc; margin:20px 0;">` +
      `<p style="color:#7D7D7D; font-size:12px;">※ 本信件由系統自動發送，請勿直接回覆。</p>` +
      `</div>`;

    // 轉換為 PDF
    const pdf = file.getAs("application/pdf").setName(`資訊部工作日報-${today}.pdf`);

    // 準備郵件選項
    const options = {
      htmlBody: htmlBody,
      attachments: [pdf],
      name: mailSettings.senderName  // 設定寄件者顯示名稱
    };

    // 加入 CC 和 BCC
    if (mailSettings.cc) {
      options.cc = mailSettings.cc;
    }
    if (mailSettings.bcc) {
      options.bcc = mailSettings.bcc;
    }

    // 寄送郵件
    GmailApp.sendEmail(mailSettings.to, subject, body, options);
    
    Logger.log(`✅ 日報已寄送`);
    Logger.log(`   主旨：${subject}`);
    Logger.log(`   寄件者：${mailSettings.senderName}`);
    Logger.log(`   收件者：${mailSettings.to}`);
    if (mailSettings.cc) Logger.log(`   副本：${mailSettings.cc}`);
    if (mailSettings.bcc) Logger.log(`   密件副本：${mailSettings.bcc}`);

  } else {
    // 找不到報表 ID
    sendErrorEmail(
      mailSettings.to,
      `資訊部工作日報失敗 - ${today}`,
      "⚠️ 找不到今日的報表 ID",
      "<p style='color:red;'>⚠️ 找不到今日的報表 ID</p>"
    );
  }
}

/**
 * 寄送錯誤通知郵件
 */
function sendErrorEmail(recipient, subject, textBody, htmlBody) {
  try {
    GmailApp.sendEmail(recipient, subject, textBody, {
      htmlBody: htmlBody
    });
    Logger.log(`❌ 錯誤通知已寄送至：${recipient}`);
  } catch (e) {
    Logger.log(`❌❌ 寄送錯誤通知失敗：${e.message}`);
  }
}