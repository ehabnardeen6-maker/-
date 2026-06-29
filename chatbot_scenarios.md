# Waay AI Chatbot — Usage Scenarios & Trigger Guide

This document lists all the interactive scenarios supported by the Waay AI Chatbot. It highlights what triggers each scenario, how the AI processes the context, and what the user sees on their screen.

---

## 🗺️ 1. Test Discovery & Recommendation
When users are unsure about their mental state or want to discover which test is right for them.

*   **User Intent:** "I want to understand myself better," "Which test should I take?", "ما الاختبار المناسب لي؟"
*   **System Action:**
    *   The backend builds a list of all tests in the database (IDs, titles, descriptions, and premium status) and injects them into the Gemini prompt along with "When to suggest" hints.
    *   The AI evaluates the user's description and outputs a specialized tag: `[SUGGEST_TEST:testId:Test Title]`.
    *   The frontend parses this tag and renders a **clickable test card** below the AI message.
*   **User Experience:** The user receives a supportive message explaining why a test is suitable, accompanied by a card they can click to start the test immediately.

---

## 😔 2. Depression / Mood Support (PHQ-9)
When a user expresses sadness, low energy, motivation issues, or depressive feelings.

*   **User Intent:** "I've been feeling really low lately," "I can't get out of bed," "أشعر بالحزن واليأس وفقدان الشغف"
*   **System Action:**
    *   The AI matches the user's symptoms with the **PHQ-9 (مقياس الأعراض التسعة للاكتئاب)** hint.
    *   If the user is on the **Free Plan**, the AI is instructed to warmly notify them that PHQ-9 is a premium test requiring a subscription, while still explaining what the test measures.
    *   If the user is **Premium**, the AI outputs the `[SUGGEST_TEST:phq9_id:مقياس الأعراض التسعة للاكتئاب]` tag.
*   **User Experience:**
    *   *Free user:* Receives empathy and a suggestion to check our premium subscription plans.
    *   *Premium user:* Receives a direct clickable link/card to take the PHQ-9.

---

## 😰 3. Social Anxiety Support (SSAQ)
When a user mentions fear of social settings, public speaking anxiety, or avoiding groups of people.

*   **User Intent:** "I get terrified of public speaking," "I avoid parties or meeting new people," "أخاف من التجمعات والتحدث أمام الغرباء"
*   **System Action:**
    *   The AI matches the user's fear with the **SSAQ (مقياس القلق الاجتماعي كسمة)** hint.
    *   The SSAQ is a free (non-premium) psychiatric test. The AI recommends it immediately using the `[SUGGEST_TEST:ssaq_id:مقياس القلق الاجتماعي كسمة]` tag.
*   **User Experience:** The user sees a supportive response validating their anxiety and a clickable card to take the SSAQ test.

---

## 😤 4. Emotional Regulation & Control (ERQ)
When a user struggles with emotional swings, bottling up emotions, or expressing feelings.

*   **User Intent:** "I bottle up my feelings and explode later," "I don't know how to express my anger," "أجد صعوبة في التحكم بانفعالاتي وتعبيري عن مشاعري"
*   **System Action:**
    *   The AI matches the description with the **ERQ (مقياس الضبط الانفعالي كسمة)** hint.
    *   Since ERQ is free, it suggests the test using the `[SUGGEST_TEST:erq_id:مقياس الضبط الانفعالي كسمة]` tag.
*   **User Experience:** The user gets psychoeducational advice on cognitive reappraisal and expressive suppression, with a card to assess their style via the ERQ test.

---

## 🔍 5. Explaining Past Test Results
When a user has already completed a test and wants to discuss their results.

*   **User Intent:** "Can you explain my last test score?", "What does my Moderate score on the depression test mean?", "ما معنى أنني حصلت على درجة مرتفعة في القلق؟"
*   **System Action:**
    *   The backend retrieves the user's test history (`TestSubmission` model) and populates the Gemini system prompt with exact results, scores, and text descriptions (e.g., "Result = Moderate, Score = 12").
    *   The AI interprets this score without diagnosing, translating it into practical advice.
*   **User Experience:** A personalized interpretation. For instance, the AI explains: *"I see you scored a 12 (Moderate) on the PHQ-9. This means you might be experiencing some depressive symptoms. Let's talk about self-care, or we can look into booking a certified coach."*

---

## 💎 6. Premium Upsell / Paywall Awareness
When a free-tier user asks about premium features or tries to access locked features.

*   **User Intent:** "What is the PHQ-9?", "Why can't I see my test results?", "كيف يمكنني الحصول على خدمات مميزة؟"
*   **System Action:**
    *   The AI check's the user's subscription status in the system prompt (`Account type: free`).
    *   The AI explains what is included in the premium plans (premium test results, unlimited coach chats, discounts on products) and guides them to the subscription plans page.
*   **User Experience:** A friendly explanation of premium perks with a markdown link to [plans.html](file:///d:/BIS%20Projects/Waay/wa3y-Frontend/pages/plans.html).

---

## 👨‍⚕️ 7. Coach Referral & Guidance
When the user's conversation shows signs of needing deeper human intervention, professional coaching, or clinical help.

*   **User Intent:** "I feel like giving up," "I want to talk to a real therapist," "أريد حجز جلسة مع مدرب أو معالج"
*   **System Action:**
    *   The AI recognizes key distress indicators or explicit requests for human assistance.
    *   It points the user to the coaching reservation section on Waay, recommending booking a session with certified coaches.
*   **User Experience:** A warm recommendation detailing how a life coach can help, along with a link to browse available coaches.

---

## 🌍 8. Bilingual Conversational Flows (English / Arabic)
The chatbot supports fully natural transitions and conversations in both English and Arabic.

*   **User Intent:** The user types in English, Arabic, or alternates between them.
*   **System Action:**
    *   The AI system prompt enforces a strict rule: *Always reply in the EXACT same language the user writes in.*
    *   The server detects the input language, and Gemini responds accordingly, matching vocabulary, tone, and cultural nuances.
*   **User Experience:** Seamless translation. Arabic queries get clear, empathic Arabic replies; English queries get English replies.

---

## ⚡ 9. Quick-Reply Chip Shortcuts
To help users start a conversation without typing a word.

*   **Trigger:** The user opens a brand-new chat session.
*   **System Action:**
    *   The frontend renders 6 pre-built interactive chips above the input bar:
        1.  **🧠 Which test suits me?** (Triggers Test Discovery)
        2.  **😔 I feel sad** (Triggers Depression Support)
        3.  **😰 I feel anxious** (Triggers Social Anxiety Support)
        4.  **😤 I struggle with emotions** (Triggers ERQ Support)
        5.  **🔍 Tell me about my results** (Triggers Test Results Interpretation)
        6.  **🌱 I want to know myself** (Triggers Personality Discovery)
*   **User Experience:** Clicking any chip automatically fills the input field, sends the message, hides the chips, and fetches the AI's response.

---

## 💾 10. Multi-Session Conversation History
When a user returns to a previous conversation they started days ago.

*   **Trigger:** User clicks on a past session in the sidebar.
*   **System Action:**
    *   The frontend calls `GET /api/chatbot/session/:sessionId` to pull historical messages.
    *   The backend loads the chat history database.
    *   When the user sends a new message, the backend reconstructs the Gemini-compatible history array so the model remembers the entire context of that specific chat.
*   **User Experience:** A continuous conversation where the AI remembers previous topics, name details, and sentiments.
