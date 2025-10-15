# French Translation Implementation Summary

## ✅ Phase 1 & 2 COMPLETED - Infrastructure Setup

### What's Been Done:

1. **vue-i18n Installed** (`v8.28.2`)
   - Compatible with Vue 2
   - Configured for English and French

2. **Locale Structure Created**
   ```
   src/store/locale/
   ├── index.js (i18n configuration)
   ├── en/
   │   ├── roles.json (23 basic roles extracted)
   │   ├── fabled.json (13 fabled characters)
   │   ├── hatred.json (jinx interactions)
   │   └── ui.json (all UI strings from Menu)
   └── fr/
       ├── roles.json (placeholder - NEEDS REPLACEMENT)
       ├── fabled.json (placeholder - NEEDS REPLACEMENT)
       ├── hatred.json (placeholder - NEEDS REPLACEMENT)
       └── ui.json (placeholder - NEEDS REPLACEMENT)
   ```

3. **i18n Integrated into Vue App**
   - Added to `main.js`
   - Vuex store updated with `setLocale` mutation
   - Locale persisted to localStorage
   - Auto-detection from browser language

4. **Menu.vue Fully Translated**
   - Language toggle added (🇬🇧 EN / 🇫🇷 FR)
   - All hardcoded strings replaced with `$t()` calls
   - All prompts/confirms using i18n

## 🔄 NEXT STEP: Add Pingumask's French Translations

### Files You Need to Provide:

Please provide the content of these 4 files from Pingumask's fork:

1. **fr/roles.json** - French role names, abilities, reminders
2. **fr/fabled.json** - French fabled characters
3. **fr/hatred.json** - French jinx reasons  
4. **fr/ui.json** - French UI strings

### Where to Put Them:

Replace the placeholder files:
- `src/store/locale/fr/roles.json`
- `src/store/locale/fr/fabled.json`
- `src/store/locale/fr/hatred.json`
- `src/store/locale/fr/ui.json`

### Format Expected:

**For `fr/roles.json`:**
```json
{
  "washerwoman": {
    "name": "Lavandière",
    "ability": "Vous commencez en sachant...",
    "firstNightReminder": "...",
    "otherNightReminder": "...",
    "reminders": {
      "Townsfolk": "Villageois",
      "Wrong": "Faux"
    }
  }
}
```

**For `fr/ui.json`:**
```json
{
  "menu": {
    "grimoire": "Grimoire",
    "hide": "Cacher",
    "show": "Afficher",
    "switchToNight": "Passer à la Nuit",
    ...
  },
  "prompts": {
    "enterBackgroundUrl": "Entrez l'URL...",
    ...
  }
}
```

## 🚀 How to Test After Adding French Files:

1. Start the development server:
   ```bash
   npm run serve
   ```

2. Open the app in your browser

3. Click the menu (⚙️ icon)

4. Go to Grimoire tab

5. Click on "Language" - it should show "🇬🇧 EN"

6. Click it to toggle to "🇫🇷 FR"

7. All UI should switch to French!

## 🔜 Still TODO:

- [ ] Replace placeholder French files with Pingumask's translations
- [ ] Update modal components to use i18n
- [ ] Test all translations
- [ ] Handle edge cases (pluralization, etc.)

## 📝 Notes:

- Language preference saves to localStorage
- Default language auto-detects from browser (French browsers → FR, others → EN)
- Can manually toggle with the language button in menu
- All ~300 roles need to be translated (in the French files you provide)
- Fabled characters (~13) need translation
- Jinx interactions need translation

