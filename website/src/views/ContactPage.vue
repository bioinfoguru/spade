<template>
  <main class="contact-page section-wrap">
    <div class="contact-heading">
      <span class="section-kicker">WE’RE HERE TO HELP</span>
      <h1>Let’s talk<span class="brand-period">.</span></h1>
      <p>Have a question, found a bug, or have an idea for SPADE? Send a note and we’ll get back to you.</p>
    </div>

    <div class="contact-grid">
      <section v-if="formSent" class="contact-form contact-success" role="status" aria-live="polite">
        <div class="success-icon"><Check :size="25" /></div>
        <div>
          <h2>Message sent</h2>
          <p>Thanks for reaching out. Your message is on its way to the SPADE support team.</p>
        </div>
        <button class="button button-quiet" type="button" @click="startAnotherMessage">Send another message</button>
      </section>

      <form v-else class="contact-form" @submit.prevent="submitForm">
        <div class="form-heading">
          <h2>Send us a message</h2>
          <p>Send your question or feedback directly to the SPADE support team.</p>
        </div>

        <div class="field-row">
          <label class="form-field">
            <span>Your name</span>
            <input v-model.trim="form.name" name="name" autocomplete="name" required placeholder="Jane Smith" />
          </label>
          <label class="form-field">
            <span>Email address</span>
            <input v-model.trim="form.email" name="_replyto" type="email" autocomplete="email" required placeholder="jane@example.com" />
          </label>
        </div>
        <label class="form-field">
          <span>Message</span>
          <textarea v-model.trim="form.message" name="message" rows="6" required placeholder="Tell us a little more…"></textarea>
        </label>
        <input type="hidden" name="_subject" value="[SPADE] Contact form message" />
        <button class="button button-primary form-submit" type="submit" :disabled="formSending">
          {{ formSending ? 'Sending…' : 'Send message' }} <ArrowUpRight :size="16" />
        </button>
        <p v-if="formMessage" class="form-status" role="status">{{ formMessage }}</p>
      </form>

      <aside class="contact-aside">
        <div class="aside-icon"><Mail :size="21" /></div>
        <span class="section-kicker">PREFER EMAIL?</span>
        <h2>Skip the form.</h2>
        <p>Write to our support inbox directly. Your email app will open so you can send us a message.</p>
        <a class="email-link" href="mailto:support@bioinfo.guru">support@bioinfo.guru <ArrowUpRight :size="15" /></a>
        <div class="aside-divider"></div>
        <p class="response-note"><span class="status-dot"></span> A real person reads every message.</p>
      </aside>
    </div>
  </main>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { ArrowUpRight, Check, Mail } from '@lucide/vue';

const form = reactive({ name: '', email: '', message: '' });
const formMessage = ref('');
const formSending = ref(false);
const formSent = ref(false);

function startAnotherMessage() {
  formMessage.value = '';
  formSent.value = false;
}

async function submitForm(event: SubmitEvent) {
  const formElement = event.currentTarget as HTMLFormElement;
  formSending.value = true;
  formMessage.value = '';

  try {
    const response = await fetch('https://formspree.io/f/mjywylkg', {
      method: 'POST',
      body: new FormData(formElement),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Form submission failed (${response.status})`);

    formElement.reset();
    form.name = '';
    form.email = '';
    form.message = '';
    formSent.value = true;
  } catch {
    formMessage.value = 'We couldn’t send your message. Please try again or email support@bioinfo.guru directly.';
  } finally {
    formSending.value = false;
  }
}
</script>
