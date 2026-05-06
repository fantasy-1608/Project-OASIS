// content.js
// Inject into VNPT HIS to provide OASIS integration

console.log('🧞 [OASIS] Content script loaded into HIS');

let oasisCapacity = { morning: 0, afternoon: 0, date: '' };

// Listen for messages from OASIS Background/SidePanel
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'OASIS_CAPACITY_UPDATE') {
    oasisCapacity = msg.payload;
  }
  
  if (msg.type === 'OPEN_PATIENT') {
    const maBA = msg.payload.maBA;
    console.log('[OASIS] Received reverse navigation request for Mã BA:', maBA);
    // VNPT HIS typically has a global search input or specific form inputs for Mã BA.
    // Thường ô nhập mã bệnh án có id/name liên quan đến 'maBenhAn'
    const searchInput = document.querySelector('input[name*="maBenhAn"], input[id*="maBenhAn"], input[placeholder*="Mã bệnh án"]');
    const searchBtn = document.querySelector('button[id*="btnSearch"], button:contains("Tìm kiếm")') || document.querySelector('.btn-primary');
    
    if (searchInput) {
      searchInput.value = maBA;
      // Kích hoạt sự kiện change/input để React/Angular (nếu có) nhận diện thay đổi
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      if (searchBtn) {
        searchBtn.click();
      } else {
        // Fallback: Gửi phím Enter
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
      }
    }
  }
});

// Inject "Lên lịch mổ" (Schedule Surgery) button into HIS UI
function injectScheduleButtons() {
  // Tìm element chứa chữ "Loại bệnh án:" trong vùng banner Hành chính
  const xpath = "//*[contains(text(), 'Loại bệnh án:')]";
  const matchingElements = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  
  if (matchingElements.snapshotLength > 0) {
    // Lấy phần tử đầu tiên tìm thấy
    const matchingElement = matchingElements.snapshotItem(0);
    
    // Tránh chèn trùng lặp
    const parentNode = matchingElement.parentNode;
    if (parentNode && parentNode.querySelector('.oasis-schedule-btn')) return;
    if (matchingElement.querySelector('.oasis-schedule-btn')) return;

    // Lấy text toàn bộ khu vực banner để trích xuất thông tin
    let currentEl = parentNode;
    let bannerText = currentEl ? currentEl.innerText : '';
    let maxDepth = 15;
    while (currentEl && currentEl !== document.body && maxDepth > 0) {
      if (currentEl.innerText && currentEl.innerText.includes('|') && currentEl.innerText.length > 50) {
        bannerText = currentEl.innerText;
        if (bannerText.match(/(?:^|\n)\s*(\d{8,12})\s*\|/)) break; // Found the level with the patient ID
      }
      currentEl = currentEl.parentElement;
      maxDepth--;
    }

    let maBA = '', hoTen = '', chanDoan = 'Đang chờ cập nhật', ngayNhapVien = '';

    // Regex trích xuất Mã BA và Họ tên (Vd: "2605050953 | VÕ THỊ LANG |")
    const nameMatch = bannerText.match(/(?:^|\n)\s*(\d{8,12})\s*\|\s*([^|]+)\s*\|/);
    if (nameMatch) {
      maBA = nameMatch[1].trim();
      hoTen = nameMatch[2].trim();
    }

    // Regex trích xuất ngày nhập viện (Vd: "| 30/04/2026 20:00:00 |")
    const admDateMatch = bannerText.match(/\|\s*(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}\s*\|/);
    if (admDateMatch) {
      ngayNhapVien = admDateMatch[1]; // "30/04/2026"
    }

    // Regex trích xuất Chẩn đoán (Nằm sau cụm ngày tháng giờ, trước thẻ BHYT hoặc cuối chuỗi)
    // Vd: "| 05/05/2026 14:15:00 | S42.2 - Gãy phần trên xương cánh tay Phải | GD4828723281350"
    // Vd: "| 05/05/2026 14:15:00 | S42.2 - Gãy phần trên xương cánh tay Phải"
    const diagMatch = bannerText.match(/\|\s*\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}\s*\|\s*([^|]+?)(?:\s*\||\s*$|\n)/);
    if (diagMatch) {
      chanDoan = diagMatch[1].trim();
    } else {
      // Fallback: Tìm dòng có mã ICD (vd "S42.2 - Gãy phần trên...")
      const fallbackMatch = bannerText.match(/\|\s*([A-Z]\d{2}(?:\.\d+)?\s*-\s*[^|]+?)(?:\s*\||\s*$|\n)/);
      if (fallbackMatch) chanDoan = fallbackMatch[1].trim();
    }

    // Create the OASIS button
    const btn = document.createElement('button');
    btn.className = 'oasis-schedule-btn';
    btn.innerHTML = '📅 Lên lịch mổ';
    btn.style.cssText = `
      background: #f59e0b; color: white; border: none; border-radius: 4px;
      padding: 3px 10px; font-size: 13px; margin-left: 16px; cursor: pointer;
      font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      vertical-align: middle; display: inline-flex; align-items: center; gap: 4px;
    `;
    
    // Cảnh báo sức chứa
    const totalToday = oasisCapacity.morning + oasisCapacity.afternoon;
    if (totalToday >= 8) {
      btn.style.background = '#ef4444'; 
      btn.title = `⚠️ Hôm nay đã có ${totalToday} ca mổ. Cân nhắc chuyển sang ngày mai.`;
    } else {
      btn.title = 'Chuyển thông tin bệnh nhân này sang OASIS để lên lịch mổ';
    }

    // Smart Highlight
    const surgicalKeywords = ['viêm ruột thừa', 'gãy', 'u nang', 'thoát vị', 'sỏi', 'ung thư', 'vỡ', 'chấn thương', 'tổn thương nội sọ', 'rách', 'sai khớp'];
    const isSurgical = surgicalKeywords.some(kw => chanDoan.toLowerCase().includes(kw));
    if (isSurgical) {
      btn.style.animation = 'oasisPulse 2s infinite';
    }

    btn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const originalText = btn.innerHTML;
      
      if (!maBA) {
        alert('⚠️ OASIS: Không thể trích xuất thông tin bệnh nhân. Vui lòng chọn lại bệnh nhân hoặc tải lại trang!');
        return;
      }

      btn.innerHTML = '⏳ Đang lấy dữ liệu...';
      let finalDiagnosis = chanDoan;

      try {
        const requestId = 'oasis_treat_' + Date.now();
        const treatments = await new Promise(resolve => {
          const handler = (ev) => {
            if (ev.data && ev.data.type === 'FETCH_TREATMENT_RESULT' && ev.data.requestId === requestId) {
              window.removeEventListener('message', handler);
              resolve(ev.data.treatmentList || []);
            }
          };
          window.addEventListener('message', handler);
          window.postMessage({
            type: 'REQ_FETCH_TREATMENT',
            rowId: maBA,
            requestId: requestId,
            token: ''
          }, window.location.origin);
          
          setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve([]);
          }, 3000); // 3s timeout
        });

        if (treatments && treatments.length > 0) {
          // Lấy tờ điều trị mới nhất (phần tử cuối cùng)
          const latestTreatment = treatments[treatments.length - 1];
          let cd = latestTreatment.CHANDOAN || latestTreatment.ChanDoan || '';
          if (latestTreatment.CHANDOANKEMTHEO) cd += ' (' + latestTreatment.CHANDOANKEMTHEO + ')';
          
          if (cd && cd.length > 5) {
             finalDiagnosis = cd;
          }
        }
      } catch (err) {
         console.error('[OASIS] Error fetching treatments:', err);
      }

      btn.innerHTML = originalText;
      
      const payload = {
        patient_id: maBA,
        patient_name: hoTen,
        diagnosis: finalDiagnosis !== 'Đang chờ cập nhật' ? finalDiagnosis : chanDoan,
        admission_date: ngayNhapVien || null,
        priority: isSurgical ? 'urgent' : 'elective'
      };

      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ oasis_pending_surgery: payload }, () => {
          chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
          chrome.runtime.sendMessage({ type: 'OASIS_OPEN_ADD_SURGERY', payload });
        });
      } else {
        chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
        chrome.runtime.sendMessage({ type: 'OASIS_OPEN_ADD_SURGERY', payload });
      }
    };

    // Chèn nút vào ngay cạnh text "Loại bệnh án: ..."
    // Gắn vào matchingElement để nó nằm ngang hàng với text
    matchingElement.appendChild(btn);
  }
}

// Inject CSS cho hiệu ứng nhấp nháy
const style = document.createElement('style');
style.textContent = `
  @keyframes oasisPulse {
    0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
    70% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
    100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
  }
`;
document.head.appendChild(style);

// Quan sát DOM thay đổi để inject nút khi user chuyển trang / filter
const observer = new MutationObserver(() => {
  injectScheduleButtons();
});
observer.observe(document.body, { childList: true, subtree: true });

// Lần chạy đầu tiên
setTimeout(injectScheduleButtons, 2000);
