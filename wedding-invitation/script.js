const SETTINGS = {
  weddingDate: "2026-08-22T11:30:00+05:30",
  clipStartSeconds: 0,
  fallbackMusicStartSeconds: 50,
  musicVolume: 0.12,
};

const opening = document.querySelector("#opening");
const invitation = document.querySelector("#invitation");
const openButton = document.querySelector("#openInvitation");
const music = document.querySelector("#music");
const mapButton = document.querySelector("#mapButton");

function openInvitation() {
  opening.classList.add("opened");
  invitation.classList.add("visible");
  sessionStorage.setItem("invitation-open", "yes");
  playMusic();
}

async function playMusic() {
  try {
    music.volume = SETTINGS.musicVolume;
    const start = musicStartTime();
    if (music.readyState > 0 && music.currentTime < start - 1) {
      music.currentTime = start;
    }
    await music.play();
  } catch {}
}

openButton.addEventListener("click", openInvitation);
function musicStartTime() {
  return music.currentSrc.toLowerCase().endsWith(".mp3")
    ? SETTINGS.fallbackMusicStartSeconds
    : SETTINGS.clipStartSeconds;
}
music.addEventListener("loadedmetadata", () => { music.currentTime = musicStartTime(); });
music.addEventListener("ended", () => { music.currentTime = musicStartTime(); playMusic(); });

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add("in-view"); });
}, { threshold: 0.16 });
document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

function updateCountdown() {
  const left = Math.max(0, new Date(SETTINGS.weddingDate).getTime() - Date.now());
  const values = {
    days: Math.floor(left / 86400000),
    hours: Math.floor((left / 3600000) % 24),
    minutes: Math.floor((left / 60000) % 60),
    seconds: Math.floor((left / 1000) % 60),
  };
  Object.entries(values).forEach(([unit, value]) => {
    document.querySelector(`[data-time="${unit}"]`).textContent = String(value).padStart(2, "0");
  });
}
updateCountdown();
setInterval(updateCountdown, 1000);

const scratchItems = Array.from(document.querySelectorAll(".scratch-circle")).map((circle) => ({
  circle,
  canvas: circle.querySelector("canvas"),
  revealed: false,
}));
let activeScratch = null;

function nextScratch() { return scratchItems.find((item) => !item.revealed); }
function updateScratchState() {
  const next = nextScratch();
  scratchItems.forEach((item) => item.circle.classList.toggle("locked", Boolean(next) && item !== next && !item.revealed));
}
function paintScratch(item) {
  const rect = item.circle.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  item.canvas.width = Math.round(rect.width * dpr);
  item.canvas.height = Math.round(rect.height * dpr);
  const ctx = item.canvas.getContext("2d", { willReadFrequently: true });
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
  gradient.addColorStop(0, "#f5dfad"); gradient.addColorStop(.5, "#aa7e39"); gradient.addColorStop(1, "#f7e5b9");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "#42341f"; ctx.font = "700 11px system-ui"; ctx.textAlign = "center";
  ctx.fillText("SCRATCH", rect.width / 2, rect.height / 2);
}
function resizeScratch() { scratchItems.forEach((item) => { if (!item.revealed) paintScratch(item); }); }
function scratchAt(event) {
  if (!activeScratch || activeScratch !== nextScratch()) return;
  const rect = activeScratch.canvas.getBoundingClientRect();
  const ctx = activeScratch.canvas.getContext("2d", { willReadFrequently: true });
  const point = event.touches ? event.touches[0] : event;
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath(); ctx.arc(point.clientX - rect.left, point.clientY - rect.top, 21, 0, Math.PI * 2); ctx.fill();
  const pixels = ctx.getImageData(0, 0, activeScratch.canvas.width, activeScratch.canvas.height).data;
  let clear = 0;
  for (let i = 3; i < pixels.length; i += 20) if (pixels[i] < 40) clear += 1;
  if ((clear / (pixels.length / 20)) * 100 > 36) {
    activeScratch.revealed = true;
    ctx.clearRect(0, 0, activeScratch.canvas.width, activeScratch.canvas.height);
    activeScratch = null;
    updateScratchState();
  }
}
scratchItems.forEach((item) => {
  item.canvas.addEventListener("pointerdown", (event) => { if (item === nextScratch()) { activeScratch = item; scratchAt(event); } });
  item.canvas.addEventListener("pointermove", scratchAt);
});
window.addEventListener("pointerup", () => { activeScratch = null; });
window.addEventListener("resize", resizeScratch);
resizeScratch(); updateScratchState();

const rsvpYes = document.querySelector("#rsvpYes");
const rsvpNo = document.querySelector("#rsvpNo");
document.querySelectorAll("[data-rsvp-choice]").forEach((button) => {
  button.addEventListener("click", () => {
    const yes = button.dataset.rsvpChoice === "yes";
    const destination = yes ? rsvpYes : rsvpNo;
    destination.classList.remove("hidden");
    destination.classList.add("in-view");
    (yes ? rsvpNo : rsvpYes).classList.add("hidden");
    setTimeout(() => destination.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  });
});

document.querySelectorAll(".rsvp-form").forEach((rsvpForm) => rsvpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector(".form-status");
  const formData = new FormData(form);
  const name = String(formData.get("name") || "Guest").trim();
  const attending = formData.get("attending") === "Yes";
  const guests = String(formData.get("guests") || "1");
  const personalMessage = attending
    ? `Thank you, ${name}. We are so happy you will be joining us. We have noted ${guests} ${guests === "1" ? "person" : "people"}.`
    : `Thank you, ${name}, for letting us know. We will miss your presence and keep you in our duas.`;

  if (window.location.protocol === "file:") {
    status.textContent = `${personalMessage} This is a local preview; it will be saved after deployment to Netlify.`;
    status.classList.add("success");
    return;
  }

  status.textContent = "Saving your response...";
  status.classList.remove("success");
  try {
    const response = await fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(formData).toString(),
    });
    if (!response.ok) throw new Error("Submission failed");
    form.reset();
    status.textContent = personalMessage;
    status.classList.add("success");
  } catch {
    status.textContent = "Your response could not be saved. Please try again.";
    status.classList.remove("success");
  }
}));

mapButton.addEventListener("click", () => sessionStorage.setItem("invitation-scroll", String(window.scrollY)));
if (sessionStorage.getItem("invitation-open") === "yes") {
  opening.classList.add("opened");
  invitation.classList.add("visible");
  requestAnimationFrame(() => window.scrollTo(0, Number(sessionStorage.getItem("invitation-scroll") || 0)));
}
