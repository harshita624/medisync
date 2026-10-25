"use client";
import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { getMedicineReminders, notifyMedicineReminderDue } from "@/lib/api";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const readStorage = key => { try { return localStorage.getItem(key); } catch { return null; } };
const writeStorage = (key, value) => { try { localStorage.setItem(key, value); } catch {} };

function zonedParts(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).reduce((result, part) => (result[part.type] = part.value, result), {});
}

function scheduledDate(dateKey, time, timeZone) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wantedWallClock = Date.UTC(year, month - 1, day, hour, minute);
  let timestamp = wantedWallClock;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(new Date(timestamp), timeZone);
    const representedWallClock = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    timestamp += wantedWallClock - representedWallClock;
  }
  return new Date(timestamp);
}

function logForDose(reminder, doseTime, dateKey) {
  const zone = reminder.timeZone || "Asia/Kolkata";
  return (reminder.adherenceLog || []).some(log => {
    if (!log.scheduledFor) return false;
    const parts = zonedParts(new Date(log.scheduledFor), zone);
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    return date === dateKey && (log.doseTime || `${parts.hour}:${parts.minute}`) === doseTime;
  });
}

function playAlarm() {
  const context = window.__healthbridgeMedicineAudioContext;
  if (!context) return;
  try { Promise.resolve(context.resume?.()).catch(() => {}); } catch {}
  [0, 0.45, 0.9].forEach(delay => window.setTimeout(() => {
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.3);
    } catch {}
  }, delay * 1000));
}

export default function MedicineReminderAlarm({ userId }) {
  const remindersRef = useRef([]);
  const pendingRef = useRef(new Set());

  useEffect(() => {
    let mounted = true;
    let checkDue = () => {};
    async function loadReminders() {
      try {
        const response = await getMedicineReminders();
        if (mounted) {
          remindersRef.current = response.data.reminders || [];
          checkDue();
        }
      } catch {}
    }

    checkDue = () => {
      if (!userId) return;
      const alarmsEnabled = readStorage(`healthbridge-medicine-alarms:${userId}`) === "enabled";
      const now = new Date();
      for (const reminder of remindersRef.current) {
        if (reminder.isActive === false) continue;
        const zone = reminder.timeZone || "Asia/Kolkata";
        const parts = zonedParts(now, zone);
        const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
        const currentMinute = Number(parts.hour) * 60 + Number(parts.minute);
        const weekdayIndex = weekdays.indexOf(new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: zone }).format(now));
        for (const doseTime of reminder.times || []) {
          const [hour, minute] = doseTime.split(":").map(Number);
          const elapsed = currentMinute - hour * 60 - minute;
          if (elapsed < 0 || elapsed > 5) continue;
          if (reminder.frequency === "weekly" && !(reminder.daysOfWeek || []).includes(weekdayIndex)) continue;
          if (logForDose(reminder, doseTime, dateKey)) continue;

          const occurrenceKey = `${reminder._id}:${dateKey}:${doseTime}`;
          const alarmKey = `healthbridge-dose-alarm:v2:${userId}:${occurrenceKey}`;
          if (!readStorage(alarmKey)) {
            writeStorage(alarmKey, "shown");
            const title = `Time for ${reminder.medicine}`;
            const body = `${reminder.dosage ? `${reminder.dosage} · ` : ""}${doseTime}${reminder.instructions ? ` · ${reminder.instructions}` : ""}`;
            if (alarmsEnabled) {
              if ("Notification" in window && Notification.permission === "granted") {
                try { new Notification(title, { body, tag: alarmKey, requireInteraction: true }); } catch {}
              }
              playAlarm();
            }
            toast(title, { icon: "💊", duration: 10000 });
          }

          const appKey = `${alarmKey}:in-app`;
          if (!readStorage(appKey) && !pendingRef.current.has(appKey)) {
            pendingRef.current.add(appKey);
            const scheduledFor = scheduledDate(dateKey, doseTime, zone).toISOString();
            notifyMedicineReminderDue(reminder._id, { doseTime, scheduledFor })
              .then(() => {
                writeStorage(appKey, "created");
                window.dispatchEvent(new Event("healthbridge:notifications-updated"));
              })
              .catch(() => {})
              .finally(() => pendingRef.current.delete(appKey));
          }
        }
      }
    };

    loadReminders();
    const refreshTimer = window.setInterval(loadReminders, 30000);
    const alarmTimer = window.setInterval(checkDue, 15000);
    const onVisible = () => { if (document.visibilityState === "visible") loadReminders(); };
    window.addEventListener("healthbridge:medicine-reminders-updated", loadReminders);
    window.addEventListener("focus", loadReminders);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mounted = false;
      window.clearInterval(refreshTimer);
      window.clearInterval(alarmTimer);
      window.removeEventListener("healthbridge:medicine-reminders-updated", loadReminders);
      window.removeEventListener("focus", loadReminders);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);

  return null;
}
