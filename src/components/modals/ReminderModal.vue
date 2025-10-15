<template>
  <Modal
    v-if="modals.reminder && availableReminders.length && players[playerIndex]"
    @close="toggleModal('reminder')"
  >
    <h3>{{ $t('ui.modal.reminder.title') }}</h3>
    <ul class="reminders">
      <li
        v-for="reminder in availableReminders"
        class="reminder"
        :class="[reminder.role]"
        :key="reminder.role + ' ' + reminder.name"
        @click="addReminder(reminder)"
      >
        <span
          class="icon"
          :style="{
            backgroundImage: `url(${
              reminder.image && grimoire.isImageOptIn
                ? reminder.image
                : require('../../assets/icons/' +
                    (reminder.imageAlt || reminder.role) +
                    '.png')
            })`
          }"
        ></span>
        <span class="text">{{ getTranslatedReminderName(reminder) }}</span>
      </li>
    </ul>
  </Modal>
</template>

<script>
import Modal from "./Modal";
import { mapMutations, mapState } from "vuex";

/**
 * Helper function that maps a reminder name with a role-based object that provides necessary visual data.
 * @param role The role for which the reminder should be generated
 * @return {function(*): {image: string|string[]|string|*, role: *, name: *, imageAlt: string|*}}
 */
const mapReminder = ({ id, image, imageAlt }) => name => ({
  role: id,
  image,
  imageAlt,
  name
});

export default {
  components: { Modal },
  props: ["playerIndex"],
  computed: {
    availableReminders() {
      let reminders = [];
      const { players, bluffs } = this.$store.state.players;
      this.$store.state.roles.forEach(role => {
        // add reminders from player roles
        if (players.some(p => p.role.id === role.id)) {
          reminders = [...reminders, ...role.reminders.map(mapReminder(role))];
        }
        // add reminders from bluff/other roles
        else if (bluffs.some(bluff => bluff.id === role.id)) {
          reminders = [...reminders, ...role.reminders.map(mapReminder(role))];
        }
        // add global reminders
        if (role.remindersGlobal && role.remindersGlobal.length) {
          reminders = [
            ...reminders,
            ...role.remindersGlobal.map(mapReminder(role))
          ];
        }
      });
      // add fabled reminders
      this.$store.state.players.fabled.forEach(role => {
        reminders = [...reminders, ...role.reminders.map(mapReminder(role))];
      });

      // add out of script traveler reminders
      this.$store.state.otherTravelers.forEach(role => {
        if (players.some(p => p.role.id === role.id)) {
          reminders = [...reminders, ...role.reminders.map(mapReminder(role))];
        }
      });

      reminders.push({ role: "good", name: this.$t('ui.modal.reminder.good') });
      reminders.push({ role: "evil", name: this.$t('ui.modal.reminder.evil') });
      reminders.push({ role: "custom", name: this.$t('ui.modal.reminder.custom') });
      return reminders;
    },
    ...mapState(["modals", "grimoire"]),
    ...mapState("players", ["players"])
  },
  methods: {
    getTranslatedReminderName(reminder) {
      // If it's a hardcoded reminder (good/evil/custom), it's already translated
      if (reminder.role === "good" || reminder.role === "evil" || reminder.role === "custom") {
        return reminder.name;
      }
      
      // For role-based reminders, we need to look up the translated reminder
      if (reminder.role && reminder.name) {
        // Get the English role data to find reminder index
        const englishRole = this.$store.state.roles.get(reminder.role);
        if (englishRole && englishRole.reminders) {
          // Find the index of this reminder in English
          const reminderIndex = englishRole.reminders.indexOf(reminder.name);
          
          if (reminderIndex !== -1) {
            // Check if we have French translation data
            const currentLocale = this.$i18n.locale;
            const roleTranslations = this.$i18n.messages[currentLocale]?.roles?.[reminder.role];
            
            if (roleTranslations && roleTranslations.reminders) {
              // If reminders is an object (transformed format)
              if (typeof roleTranslations.reminders === 'object' && !Array.isArray(roleTranslations.reminders)) {
                const reminderKeys = Object.keys(roleTranslations.reminders);
                if (reminderKeys[reminderIndex]) {
                  return reminderKeys[reminderIndex];
                }
              }
              // If reminders is still an array
              else if (Array.isArray(roleTranslations.reminders) && roleTranslations.reminders[reminderIndex]) {
                return roleTranslations.reminders[reminderIndex];
              }
            }
          }
        }
        
        // Try global reminders
        if (englishRole && englishRole.remindersGlobal) {
          const reminderIndex = englishRole.remindersGlobal.indexOf(reminder.name);
          if (reminderIndex !== -1) {
            const currentLocale = this.$i18n.locale;
            const roleTranslations = this.$i18n.messages[currentLocale]?.roles?.[reminder.role];
            
            if (roleTranslations && roleTranslations.remindersGlobal) {
              if (Array.isArray(roleTranslations.remindersGlobal) && roleTranslations.remindersGlobal[reminderIndex]) {
                return roleTranslations.remindersGlobal[reminderIndex];
              }
            }
          }
        }
      }
      
      // Fallback to original name
      return reminder.name;
    },
    addReminder(reminder) {
      const player = this.$store.state.players.players[this.playerIndex];
      let value;
      if (reminder.role === "custom") {
        const name = prompt(this.$t('ui.modal.reminder.customPrompt'));
        if (!name) return;
        value = [...player.reminders, { role: "custom", name }];
      } else {
        value = [...player.reminders, reminder];
      }
      this.$store.commit("players/update", {
        player,
        property: "reminders",
        value
      });
      this.$store.commit("toggleModal", "reminder");
    },
    ...mapMutations(["toggleModal"])
  }
};
</script>

<style scoped lang="scss">
ul.reminders .reminder {
  background: url("../../assets/reminder.png") center center;
  background-size: 100%;
  width: 14vh;
  height: 14vh;
  max-width: 100px;
  max-height: 100px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 1%;

  border-radius: 50%;
  border: 3px solid black;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  cursor: pointer;
  line-height: 100%;
  transition: transform 500ms ease;

  .icon {
    position: absolute;
    top: 0;
    width: 90%;
    height: 90%;
    background-size: 100%;
    background-position: center center;
    background-repeat: no-repeat;
  }

  .text {
    color: black;
    font-size: 65%;
    font-weight: bold;
    text-align: center;
    top: 28%;
    width: 80%;
    line-height: 1;
  }

  &:hover {
    transform: scale(1.2);
  }
}
</style>
