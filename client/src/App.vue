<template>
  <div class="chat-container">
    <div class="messages">
      <div
          v-for="(m, i) in messages"
          :key="i"
          :class="['message', { system: m.system, sent: m.sent }]"
      >
        {{ m.text }}
      </div>
    </div>
    <div class="controls">
      <input
          v-model="input"
          @keyup.enter="sendMessage"
          placeholder="Wpisz wiadomość..."
      />
      <button @click="sendMessage">Wyślij</button>
      <button @click="nextChat">NEXT</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');
const messages = ref([]);
const input = ref('');

// Odbieramy eventy systemowe
onMounted(() => {
  socket.on('system', text =>
      messages.value.push({ text, system: true, sent: false })
  );
  // Wiadomości od innych użytkowników
  socket.on('message', text =>
      messages.value.push({ text, system: false, sent: false })
  );
});

function sendMessage() {
  if (!input.value) return;
  // Wyślij do serwera (serwer robi broadcast)
  socket.emit('message', input.value);
  // Wstaw od razu lokalnie jako własną wiadomość
  messages.value.push({ text: input.value, system: false, sent: true });
  input.value = '';
}

function nextChat() {
  socket.emit('next');
  messages.value = [];
}
</script>

<style scoped>
.chat-container {
  max-width: 500px;
  margin: auto;
  display: flex;
  flex-direction: column;
  height: 90vh;
}
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  border: 1px solid #ccc;
  display: flex;
  flex-direction: column;
}
.message {
  margin: 0.5rem 0;
  padding: 0.5rem;
  border-radius: 0.25rem;
  /* domyślnie wyrównanie do lewej dla systemu i otrzymanych */
  text-align: left;
}
.message.system {
  color: #888;
  font-style: italic;
}
/* wiadomości nadawcy po prawej */
.message.sent {
  text-align: right;
}
.controls {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
}
input {
  flex: 1;
  padding: 0.5rem;
}
button {
  padding: 0.5rem 1rem;
}
</style>
