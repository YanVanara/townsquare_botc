import Vue from "vue";
import VueI18n from "vue-i18n";

// Import English locale files
import enRoles from "./en/roles.json";
import enFabled from "./en/fabled.json";
import enHatred from "./en/hatred.json";
import enUI from "./en/ui.json";

// Import French locale files
import frRolesArray from "./fr/roles.json";
import frFabledArray from "./fr/fabled.json";
import frHatredArray from "./fr/hatred.json";
import frUI from "./fr/ui.json";

Vue.use(VueI18n);

// Transform array format to object format for roles
const transformRolesToObject = (rolesArray) => {
  if (!Array.isArray(rolesArray)) return rolesArray;
  
  const rolesObject = {};
  rolesArray.forEach(role => {
    rolesObject[role.id] = {
      name: role.name,
      ability: role.ability || "",
      firstNightReminder: role.firstNightReminder || "",
      otherNightReminder: role.otherNightReminder || "",
      reminders: role.reminders || [],
      remindersGlobal: role.remindersGlobal || []
    };
  });
  
  return rolesObject;
};

// Transform array format to object format for fabled
const transformFabledToObject = (fabledArray) => {
  if (!Array.isArray(fabledArray)) return fabledArray;
  
  const fabledObject = {};
  fabledArray.forEach(fabled => {
    fabledObject[fabled.id] = {
      name: fabled.name,
      ability: fabled.ability || ""
    };
  });
  
  return fabledObject;
};

// Transform hatred array to object format
const transformHatredToObject = (hatredArray) => {
  if (!Array.isArray(hatredArray)) return hatredArray;
  
  const hatredObject = {};
  hatredArray.forEach(item => {
    if (item.hatred && Array.isArray(item.hatred)) {
      hatredObject[item.id] = {};
      item.hatred.forEach(jinx => {
        hatredObject[item.id][jinx.id] = jinx.reason;
      });
    }
  });
  
  return hatredObject;
};

// Transform French data from array to object format
const frRoles = transformRolesToObject(frRolesArray);
const frFabled = transformFabledToObject(frFabledArray);
const frHatred = transformHatredToObject(frHatredArray);

// Combine all locale messages
const messages = {
  en: {
    roles: enRoles,
    fabled: enFabled,
    hatred: enHatred,
    ui: enUI
  },
  fr: {
    roles: frRoles,
    fabled: frFabled,
    hatred: frHatred,
    ui: frUI
  }
};

// Get locale from localStorage or browser, default to French
const getDefaultLocale = () => {
  const savedLocale = localStorage.getItem("locale");
  if (savedLocale && (savedLocale === "en" || savedLocale === "fr")) {
    return savedLocale;
  }
  
  // Check browser language
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith("en")) {
    return "en";
  }
  
  // Default to French
  return "fr";
};

// Create VueI18n instance
const i18n = new VueI18n({
  locale: getDefaultLocale(),
  fallbackLocale: "en",
  messages,
  silentTranslationWarn: true // Prevent console warnings for missing keys in dev
});

export default i18n;

