/**
 * The shell's own texts (lock screen, offline screen, settings sheet, reminder, Android channels)
 * in the three languages the web app offers. The web app tells the shell which one the user chose;
 * until it does, the phone's language decides.
 */
export type Lang = 'he' | 'en' | 'ar';

/** Pure: any language code (he, iw, en-US, ar-IL…) → one of ours; anything else is Hebrew. */
export function asLang(code: unknown): Lang {
  const c = typeof code === 'string' ? code.toLowerCase().slice(0, 2) : '';
  if (c === 'en') return 'en';
  if (c === 'ar') return 'ar';
  return 'he';
}

export type Strings = {
  offlineTitle: string;
  offlineText: string;
  retry: string;
  lockedTitle: string;
  unlockButton: string;
  unlockPrompt: string;
  cancel: string;
  usePasscode: string;
  notificationsBlocked: string;
  introTitle: string;
  settingsTitle: string;
  maybeLater: string;
  close: string;
  lockLabel: string;
  lockSub: string;
  lockUnavailable: string;
  reminderLabel: string;
  reminderSub: string;
  reminderTitle: string;
  reminderBody: string;
  channelReminders: string;
  channelFamily: string;
  channelFamilyDesc: string;
};

export const STRINGS: Record<Lang, Strings> = {
  he: {
    offlineTitle: 'אין חיבור לאינטרנט',
    offlineText: 'הכיס המשפחתי צריך רשת כדי לשמור ולסנכרן את הנתונים של כל המשפחה.',
    retry: 'לנסות שוב',
    lockedTitle: 'הכיס המשפחתי נעול',
    unlockButton: 'פתיחה',
    unlockPrompt: 'פתיחת הכיס המשפחתי',
    cancel: 'ביטול',
    usePasscode: 'שימוש בקוד',
    notificationsBlocked: 'ההתראות חסומות לאפליקציה. אפשר לאשר אותן בהגדרות הטלפון ← הכיס המשפחתי ← עדכונים.',
    introTitle: 'שני דברים קטנים שעוזרים',
    settingsTitle: 'הגדרות האפליקציה',
    maybeLater: 'אולי אחר כך',
    close: 'סגירה',
    lockLabel: 'נעילה בזיהוי פנים / טביעת אצבע',
    lockSub: 'כשהאפליקציה נפתחת, או חוזרת אחרי דקה ברקע, היא מבקשת לזהות אתכם. הנתונים הכספיים נשארים רק שלכם.',
    lockUnavailable: 'בטלפון הזה לא מוגדר זיהוי פנים או טביעת אצבע. אפשר להגדיר אותו בהגדרות הטלפון.',
    reminderLabel: 'תזכורת יומית לרשום הוצאות',
    reminderSub: 'תזכורת אחת בערב. מי שרושם כל יום יודע בכל רגע כמה נשאר עד סוף החודש.',
    reminderTitle: 'רשמתם את ההוצאות של היום?',
    reminderBody: 'דקה אחת עכשיו חוסכת הפתעות בסוף החודש.',
    channelReminders: 'תזכורות',
    channelFamily: 'עדכוני המשפחה',
    channelFamilyDesc: 'הכנסה או הוצאה חדשה של בן משפחה, וסיכום של אתמול',
  },
  en: {
    offlineTitle: 'No internet connection',
    offlineText: 'The Family Pocket needs a connection to save and sync the whole family’s data.',
    retry: 'Try again',
    lockedTitle: 'The Family Pocket is locked',
    unlockButton: 'Unlock',
    unlockPrompt: 'Unlock The Family Pocket',
    cancel: 'Cancel',
    usePasscode: 'Use passcode',
    notificationsBlocked: 'Notifications are blocked for this app. You can allow them in your phone’s Settings → The Family Pocket → Notifications.',
    introTitle: 'Two small things that help',
    settingsTitle: 'App settings',
    maybeLater: 'Maybe later',
    close: 'Close',
    lockLabel: 'Lock with Face ID / fingerprint',
    lockSub: 'When the app opens, or returns after a minute in the background, it asks to identify you. Your financial data stays yours alone.',
    lockUnavailable: 'Face ID or fingerprint isn’t set up on this phone. You can set it up in your phone’s settings.',
    reminderLabel: 'Daily reminder to log expenses',
    reminderSub: 'One reminder in the evening. Logging every day means you always know how much is left until the end of the month.',
    reminderTitle: 'Did you log today’s expenses?',
    reminderBody: 'One minute now saves surprises at the end of the month.',
    channelReminders: 'Reminders',
    channelFamily: 'Family updates',
    channelFamilyDesc: 'A new expense or income from a family member, and yesterday’s summary',
  },
  ar: {
    offlineTitle: 'لا يوجد اتصال بالإنترنت',
    offlineText: 'يحتاج الجيب العائلي إلى اتصال بالشبكة لحفظ بيانات العائلة كلها ومزامنتها.',
    retry: 'المحاولة مجددًا',
    lockedTitle: 'الجيب العائلي مقفل',
    unlockButton: 'فتح',
    unlockPrompt: 'فتح الجيب العائلي',
    cancel: 'إلغاء',
    usePasscode: 'استخدام الرمز',
    notificationsBlocked: 'الإشعارات محظورة لهذا التطبيق. يمكنكم السماح بها من إعدادات الهاتف ← الجيب العائلي ← الإشعارات.',
    introTitle: 'أمران صغيران يساعدان',
    settingsTitle: 'إعدادات التطبيق',
    maybeLater: 'ربما لاحقًا',
    close: 'إغلاق',
    lockLabel: 'القفل ببصمة الوجه / الإصبع',
    lockSub: 'عند فتح التطبيق، أو عودته بعد دقيقة في الخلفية، يطلب التعرّف عليكم. تبقى بياناتكم المالية لكم وحدكم.',
    lockUnavailable: 'لم يتم إعداد بصمة الوجه أو الإصبع على هذا الهاتف. يمكن إعدادها من إعدادات الهاتف.',
    reminderLabel: 'تذكير يومي بتسجيل المصاريف',
    reminderSub: 'تذكير واحد في المساء. من يسجّل كل يوم يعرف في كل لحظة كم تبقّى حتى نهاية الشهر.',
    reminderTitle: 'هل سجّلتم مصاريف اليوم؟',
    reminderBody: 'دقيقة واحدة الآن توفّر عليكم المفاجآت في نهاية الشهر.',
    channelReminders: 'تذكيرات',
    channelFamily: 'تحديثات العائلة',
    channelFamilyDesc: 'دخل أو مصروف جديد من فرد في العائلة، وملخص الأمس',
  },
};

/**
 * Pure: the app is built right-to-left (forcesRTL), where React Native mirrors "left"/"right"
 * and row order. English needs them mirrored back so it reads left-to-right.
 */
export function layoutFor(lang: Lang, isRTL: boolean) {
  const flip = isRTL === (lang === 'en'); // the system direction is wrong for this language
  return {
    textAlign: (flip ? 'right' : 'left') as 'left' | 'right',
    rowDirection: (flip ? 'row-reverse' : 'row') as 'row' | 'row-reverse',
    writingDirection: (lang === 'en' ? 'ltr' : 'rtl') as 'ltr' | 'rtl',
  };
}

/** Runs after each page load: tells the shell the language the web app is showing. */
export const REPORT_LANG_SCRIPT = `
(function(){
  try {
    var l = document.documentElement.lang || 'he';
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'lang', lang:l}));
  } catch (e) {}
  true;
})();
`;
