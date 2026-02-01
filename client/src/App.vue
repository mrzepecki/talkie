<script setup lang="ts">
import {nextTick, onMounted, ref, watch} from "vue";
import {createSocket} from "./composables/useSocket";

type Msg = { from: "me" | "stranger"; text: string };

const status = ref<"idle" | "queued" | "in_room">("idle");
const messages = ref<Msg[]>([]);
const input = ref("");
const chatBox = ref<HTMLElement | null>(null);

let socket: any;


onMounted(() => {
  socket = createSocket();

  socket.on("queue:status", (p: any) => {
    status.value = p.status;
  });

  socket.on("chat:matched", () => {
    status.value = "in_room";
    messages.value = [];
  });

  socket.on("chat:message", (m: any) => {
    messages.value.push({from: "stranger", text: m.text});
  });

  socket.on("chat:partner_left", () => {
    status.value = "queued";
  });

  socket.on("connect_error", (e: any) => {
    alert(e.message || "connect_error");
  });
});

function startChat() {
  socket.emit("queue:join");
}

function nextChat() {
  socket.emit("chat:next");
}

function exitChat() {
  socket.emit("queue:leave");
  status.value = "idle";
  messages.value = [];
}

function send() {
  const t = input.value.trim();
  if (!t || status.value !== "in_room") return;
  socket.emit("chat:message", {text: t});
  messages.value.push({from: "me", text: t});
  input.value = "";
}

async function scrollToBottom() {
  await nextTick();
  const el = chatBox.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

// auto-scroll gdy przybywa wiadomości
watch(
    () => messages.value.length,
    () => scrollToBottom()
);
</script>

<template>
  <div>

    <div>
      <button v-if="status !== 'in_room'" @click="startChat" class="button">Start chat</button>
      <template v-else>
        <button @click="nextChat" class="button">NEXT</button>
      </template>
    </div>

    <div class="messages" ref="chatBox">
      <div class="status">
        Status: <b>{{ status }}</b>
      </div>

      <div v-if="messages.length === 0" style="opacity:0.6;">
        {{ status === 'queued' ? 'Looking for chat…' : 'Click on Start Chat!' }}
      </div>

      <div v-for="(m, i) in messages" :key="i" class="message" :class="{ 'message--me': m.from === 'me' }">
        {{ m.text }}
      </div>
    </div>

    <div style="display:flex; gap:8px; margin-top: 17px; position: relative">
      <input
          v-model="input"
          placeholder="Message..."
          @keyup.enter="send"
          class="input"
      />
      <button @click="send" :disabled="status !== 'in_room'" class="send">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
              d="M23.6954 0.291234C23.5604 0.156908 23.3899 0.0639048 23.2039 0.0231609C23.0179 -0.0175829 22.8241 -0.00437409 22.6454 0.0612345L0.645352 8.06123C0.45562 8.1332 0.292272 8.26118 0.177003 8.42819C0.0617345 8.59519 0 8.79331 0 8.99623C0 9.19916 0.0617345 9.39728 0.177003 9.56428C0.292272 9.73128 0.45562 9.85927 0.645352 9.93123L10.2454 13.7712L14.0854 23.3712C14.1575 23.5526 14.2812 23.7089 14.4411 23.8209C14.601 23.9328 14.7902 23.9955 14.9854 24.0012C15.1874 23.9971 15.3835 23.9318 15.5478 23.814C15.712 23.6962 15.8367 23.5313 15.9054 23.3412L23.9054 1.34123C23.9735 1.16431 23.9899 0.971665 23.9527 0.785758C23.9156 0.599851 23.8263 0.428345 23.6954 0.291234ZM14.9854 20.2012L12.1954 13.2012L16.9854 8.41123L15.5754 7.00123L10.7454 11.8312L3.78535 9.00123L21.3154 2.67123L14.9854 20.2012Z"
              fill="black"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style>
body {
  font-family: "Lexend", sans-serif;
  margin: 0;
  font-size: 20px;
  background: #DDB9FF;
  padding: 17px;
}

.button, .input {
  width: 100%;
  height: 50px;
  font-size: 24px;
  line-height: 1;
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 15px;
  outline: 0;
  border: 1px solid #431949;
  background: transparent;
  padding: 0 10px;
  color: #431949;

  &::placeholder{
    color: #431949;
  }
}

.messages {
  position: relative;
  margin-top: 17px;
  height: calc(100dvh - 205px);
  overflow: auto;
  background: #E4C7FF;
  border-radius: 15px;
  padding: 17px;
  display: flex;
  flex-direction: column;
}

.message {
  max-width: 80%;
  width: fit-content;
  justify-self: end;
}

.message--me {
  align-self: end;
}

.status {
  width: 100%;
  position: absolute;
  top: 3px;
  left: 0;
  font-size: 10px;
  text-align: center;
  opacity: 0.2;
}

.send{
  width: auto;
  height: 50px;
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 15px;
  outline: 0;
  border: 1px solid #431949;
  background: transparent;
  padding: 0 10px;
}


</style>
