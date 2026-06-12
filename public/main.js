const form = document.querySelector("#memberForm");
const submitButton = document.querySelector("#submitButton");
const message = document.querySelector("#formMessage");

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = `form-message ${type}`.trim();
}

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
    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, alumniId })
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "提交失败，请稍后再试");
    }

    form.reset();
    setMessage("提交成功，会员升级信息已登记。", "success");
  } catch (error) {
    setMessage(error.message || "提交失败，请稍后再试", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "下一步";
  }
});
