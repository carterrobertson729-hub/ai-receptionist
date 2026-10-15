# Spanish test script (Tonic Barbershop agent)

Spanish is the one language we promise, so test it fully before telling anyone it works. Use a web call. Say each line in Spanish; the English meaning is in parentheses. You do not need to be perfect: the point is to see whether the assistant keeps speaking Spanish all the way through.

## Call 1: switch mid-call and book
1. Start by saying (in English): "Hi, do you speak Spanish?" It should switch to Spanish. If not, say: "Hola, ¿habla español?"
2. "Quiero un corte de pelo para el sábado por la mañana." (I want a haircut for Saturday morning.)
3. "¿Cuánto cuesta?" (How much is it?) It should say the price in Spanish ("veintisiete dólares").
4. Pick a time when it offers times: "Las diez, por favor." (Ten o'clock, please.)
5. Name and phone: "Me llamo Carlos Ramírez. Mi número es cinco cinco cinco, uno dos tres, cuatro cinco seis siete." (My name is Carlos Ramírez. My number is 555-123-4567.)
6. It should confirm the booking in Spanish. Check the calendar: the event should read "Men's Haircut - Carlos Ramírez" (English service name, name as spoken).
7. "¿Aceptan tarjeta?" (Do you take cards?) It should say yes, in Spanish. "¿Aceptan clientes sin cita?" (Do you take walk-ins?) Yes.

## Call 2: kid and parent
"Necesito un corte para mi hijo de diez años y otro para mí." (I need a cut for my 10-year-old son and one for me.) It should pick the Boys Cut ($22) for the child and the Men's Haircut ($27) for you, and book them one at a time.

## Call 3: manage an appointment
"Quiero cancelar mi cita." (I want to cancel my appointment.) Give the same name and number. It should find it, ask you to confirm in Spanish, and cancel.

## Call 4: other languages and English
- Say a sentence in another language (for example French: "Bonjour, je voudrais un rendez-vous"). It should say, in simple English or Spanish, that it can help in English or Spanish, and offer a message.
- Start in Spanish, then switch back to English mid-call. It should follow you.

## What to check
- Did it keep speaking Spanish after the first answer, including the confirmation and goodbye?
- Were the prices and times said naturally?
- Was the booking correct (service, time, name, phone)?
- Did the voice sound right for Spanish? If the accent is off, choose a different Spanish-speaking voice in Retell.
- Did it ever speak Spanish with an English voice? If so, the voice or language setting needs changing.

## Retell settings for Spanish (the system reads them, not the prompt)
1. In the agent's settings, set Language to the Multiselect option and choose English (US) and Spanish. This helps speech recognition and pronunciation. (Retell's docs say the language setting does not control what language the assistant replies in. That is the prompt's job.)
2. Pick a voice that speaks Spanish well. Retell's docs say the language setting does not guarantee an accent, so test the voice.
3. Keep tool arguments in English. The prompt says this.
