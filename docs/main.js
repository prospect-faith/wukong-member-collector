const form = document.querySelector("#memberForm");
const submitButton = document.querySelector("#submitButton");
const message = document.querySelector("#formMessage");
const successModal = document.querySelector("#successModal");
const successClose = document.querySelector("#successClose");
const appConfig = window.WUKONG_COLLECTOR_CONFIG || {};

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = `form-message ${type}`.trim();
}

function showSuccessModal() {
  successModal.hidden = false;
  document.body.classList.add("modal-open");
  successClose.focus();
}

function closeSuccessModal() {
  successModal.hidden = true;
  document.body.classList.remove("modal-open");
}

successClose.addEventListener("click", closeSuccessModal);
successModal.addEventListener("click", (event) => {
  if (event.target.hasAttribute("data-close-success")) {
    closeSuccessModal();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const phone = form.phone.value.replace(/\s/g, "");
  const alumniId = form.alumniId.value.trim();

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    setMessage("请输入有效的 11 位手机号码", "error");
    form.phone.focus();
    return;
  }

  if (!/^[0-9A-Za-z_-]{4,32}$/.test(alumniId)) {
    setMessage("请输入 4-32 位校友卡号", "error");
    form.alumniId.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "提交中...";
  setMessage("");

  try {
    const result = await submitMemberInfo({ phone, alumniId });

    if (!result.ok) {
      throw new Error(result.message || "提交失败，请稍后再试");
    }

    form.reset();
    showSuccessModal();
  } catch (error) {
    setMessage(error.message || "提交失败，请稍后再试", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "下一步";
  }
});

async function submitMemberInfo({ phone, alumniId }) {
  if (appConfig.supabaseUrl && appConfig.supabaseAnonKey) {
    const response = await fetch(`${appConfig.supabaseUrl.replace(/\/+$/, "")}/rest/v1/submissions`, {
      method: "POST",
      headers: {
        apikey: appConfig.supabaseAnonKey,
        Authorization: `Bearer ${appConfig.supabaseAnonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        phone,
        alumni_id: alumniId,
        user_agent: navigator.userAgent
      })
    });

    if (!response.ok) {
      return { ok: false, message: "提交失败，请稍后再试" };
    }

    return { ok: true };
  }

  const response = await fetch("/api/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, alumniId })
  });
  return response.json();
}
