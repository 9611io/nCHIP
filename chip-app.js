// =====================================================================================
// chip-app.js
// This script is designed to work with the accompanying HTML file.
// It uses the NEW element IDs for the redesigned layout.
//
// IMPORTANT: If you were previously using an older chip-app.js,
// this new version replaces it and is compatible with the new HTML.
// =====================================================================================

document.addEventListener('DOMContentLoaded', () => {
    // DOM Element References
    const chipAppContainer = document.getElementById('chip-app-container');
    if (!chipAppContainer) {
        console.error("CRITICAL DOM ERROR: #chip-app-container not found. App cannot start.");
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = "color:red;background:white;padding:20px;position:fixed;top:10px;left:10px;z-index:10000;border:2px solid darkred; font-family: Arial, sans-serif; font-size: 16px;";
        errorDiv.innerHTML = "<strong>Application Critical Error:</strong><br>The main application container ('#chip-app-container') is missing. CHIP cannot start.";
        document.body.appendChild(errorDiv);
        return;
    }

    const skillButtons = Array.from(chipAppContainer.querySelectorAll('.skill-button'));
    const aiResponseDisplay = chipAppContainer.querySelector('#ai-response-display');
    const mainBotContentWrapper = aiResponseDisplay.querySelector('.bot-bubble-main-content-wrapper');
    
    const chatInput = chipAppContainer.querySelector('#chat-input');
    const sendButton = chipAppContainer.querySelector('#send-button');
    const chipCharacterImage = chipAppContainer.querySelector('#chip-character-image');
    
    // ** Using the CORRECTED IDs for the new layout **
    const instructionsContentBar = chipAppContainer.querySelector('#skill-instructions-content-bar'); 
    const skillActionButtonContainerBar = chipAppContainer.querySelector('#skill-action-button-container-bar'); 

    // Application State
    let ALL_PROMPTS = [];
    let currentSkill = 'Clarifying'; // Default skill
    let currentPromptId = null;
    let currentPromptDetails = null;
    let conversationHistory = []; 
    let currentExhibitIndex = 0;
    let doneAsking = false;
    let hypothesisCount = 0;

    const OPENAI_PROXY_URL = 'https://chip.zoran-a18.workers.dev/';
    const PROMPTS_JSON_URL = 'https://raw.githubusercontent.com/9611io/CHIP/main/prompts.json';

    const chipImages = {
        default: "https://9611.io/wp-content/uploads/2025/05/CHIP-wait.png",
        waiting: "https://9611.io/wp-content/uploads/2025/05/CHIP-wait.png",
        talking: "https://9611.io/wp-content/uploads/2025/05/CHIP-talk.png",
        writing: "https://9611.io/wp-content/uploads/2025/05/CHIP-write.png",
        listening: "https://9611.io/wp-content/uploads/2025/05/CHIP-looking-forward-notepad.png",
        thinking: "https://9611.io/wp-content/uploads/2025/05/CHIP-think.png",
        feedback: "https://9611.io/wp-content/uploads/2025/05/CHIP-fb.png",
        clapping: "https://9611.io/wp-content/uploads/2025/05/CHIP-clapping.png",
        pointingUpward: "https://9611.io/wp-content/uploads/2025/05/CHIP-talk.png"
    };
    const chipAvatarSmall = "https://placehold.co/40x40/007ACC/FFFFFF?text=C&font=Inter&bold";
    const chipAvatarError = "https://placehold.co/40x40/000000/FFFFFF?text=C&font=Inter";

    const skillInstructions = {
        "Clarifying": "Read the prompt, then enter your clarifying questions one at a time. Press \"Send\" to submit. When satisfied, click the \"End Clarification Questions\" button in this panel.",
        "Hypothesis": "Formulate an initial hypothesis and what you'd like to investigate. CHIP will provide info. Refine up to 3 times. Click the \"End Hypothesis Formulation\" button in this panel when finished.",
        "Frameworks": "Outline your framework and proposed approach. When satisfied, press the \"Submit Framework for Feedback\" button that will appear in this panel.",
        "Analysis": "Analyze the exhibit(s) and explain its significance. Enter your analysis and click \"Submit Analysis\". For multiple exhibits, you'll proceed sequentially until the final one. The submit button will appear in this panel.",
        "Recommendation": "Review the case and findings, then structure your final recommendation (rationale, risks, next steps). Click the \"Submit Recommendation\" button that will appear in this panel."
    };

    // ** This function now uses instructionsContentBar **
    function updateInstructionsUI(skill) {
        console.log("Updating instructions for skill:", skill); 
        if (!instructionsContentBar) { 
            console.error("updateInstructionsUI: #skill-instructions-content-bar element not found. Cannot update instructions."); 
            return; 
        }
        const instructionText = skillInstructions[skill] || "Select a skill to see instructions.";
        instructionsContentBar.innerHTML = `<p>${instructionText}</p>`;
        console.log("Instructions updated to:", instructionText); 
    }

    function setChipCharacterPose(poseKey) {
        if (!chipCharacterImage) { console.error("setChipCharacterPose: chipCharacterImage element not found."); return; }
        const pose = poseKey || 'default';
        chipCharacterImage.src = chipImages[pose] || chipImages.default;
    }
    
    function setMainBotContentArea(htmlString) { 
        if (!mainBotContentWrapper) {
            console.error("CRITICAL: .bot-bubble-main-content-wrapper NOT FOUND.");
            return;
        }
        mainBotContentWrapper.innerHTML = htmlString;
        const mainInteractionContent = document.getElementById('main-interaction-content');
        if (mainInteractionContent) mainInteractionContent.scrollTop = 0; 
    }

    function appendUserChatBubble(text) { 
        if (!aiResponseDisplay) { console.error("appendUserChatBubble: aiResponseDisplay element not found."); return; }
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item-user';
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble user-bubble-chat';
        bubble.textContent = text;
        chatItem.appendChild(bubble);
        const avatar = document.createElement('div');
        avatar.className = 'chat-avatar user-avatar';
        avatar.textContent = 'U';
        chatItem.appendChild(avatar);
        aiResponseDisplay.appendChild(chatItem);

        const mainInteractionContent = document.getElementById('main-interaction-content');
        if (mainInteractionContent) mainInteractionContent.scrollTop = mainInteractionContent.scrollHeight;
    }

    function appendAiChatBubble(htmlText) { 
        if (!aiResponseDisplay) { console.error("appendAiChatBubble: aiResponseDisplay element not found."); return; }
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item-ai';
        const avatar = document.createElement('div');
        avatar.className = 'chat-avatar ai-avatar';
        const img = document.createElement('img');
        img.src = chipAvatarSmall;
        img.alt = 'CHIP';
        img.onerror = () => { img.src = chipAvatarError; console.error('Error loading CHIP small avatar for chat.'); };
        avatar.appendChild(img);
        chatItem.appendChild(avatar);
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble ai-bubble-chat';
        bubble.innerHTML = htmlText;
        chatItem.appendChild(bubble);
        aiResponseDisplay.appendChild(chatItem);
        
        const mainInteractionContent = document.getElementById('main-interaction-content');
        if (mainInteractionContent) mainInteractionContent.scrollTop = mainInteractionContent.scrollHeight;
    }

    function displayTypingIndicatorInMain() {
        setChipCharacterPose('thinking');
        appendAiChatBubble(`<p class="p-2 text-[var(--color-text-medium)] italic">CHIP is typing...</p>`);
    }
    
    function resetSkillState() {
        console.log("Resetting skill state for:", currentSkill);
        currentPromptId = null;
        currentPromptDetails = null;
        currentExhibitIndex = 0;
        doneAsking = false;
        hypothesisCount = 0;

        if (mainBotContentWrapper) { 
            mainBotContentWrapper.innerHTML = '';
        }
        if (aiResponseDisplay) { 
            Array.from(aiResponseDisplay.children).forEach(child => {
                if (!child.classList.contains('bot-bubble-main-content-wrapper')) {
                    aiResponseDisplay.removeChild(child);
                }
            });
        }
        // ** This function now uses skillActionButtonContainerBar **
        if (skillActionButtonContainerBar) { 
            skillActionButtonContainerBar.innerHTML = '';
        } else {
            console.error("resetSkillState: #skill-action-button-container-bar not found.");
        }
    }

    // ** This function now uses skillActionButtonContainerBar **
    function createSkillActionButton(text, id, onClickHandler) { 
        if (!skillActionButtonContainerBar) { 
            console.error("createSkillActionButton: #skill-action-button-container-bar element not found. Cannot create button."); 
            return; 
        }
        skillActionButtonContainerBar.innerHTML = ''; 
        const button = document.createElement('button');
        button.id = id;
        button.textContent = text;
        button.classList.add('action-button'); 
        button.addEventListener('click', onClickHandler);
        skillActionButtonContainerBar.appendChild(button);
    }

    function handleEndClarifying() {
        console.log("Ending Clarifying Questions");
        doneAsking = true;
        if(skillActionButtonContainerBar) skillActionButtonContainerBar.innerHTML = '';
        setChipCharacterPose('feedback');
        appendAiChatBubble(`<p class="p-2">Clarifying questions ended. CHIP will now provide feedback on this section if available, or you can proceed to the next skill.</p>`);
    }

    function handleEndHypothesis() {
        console.log("Ending Hypothesis Formulation");
        doneAsking = true;
        if(skillActionButtonContainerBar) skillActionButtonContainerBar.innerHTML = '';
        setChipCharacterPose('feedback');
        appendAiChatBubble(`<p class="p-2">Hypothesis formulation ended. CHIP will now provide feedback.</p>`);
    }

    function handleSubmitFramework() {
        console.log("Framework Submitted");
        doneAsking = true; 
        if(skillActionButtonContainerBar) skillActionButtonContainerBar.innerHTML = '';
        setChipCharacterPose('feedback');
        appendAiChatBubble(`<p class="p-2">Framework submitted. CHIP will provide feedback.</p>`);
    }
    function handleSubmitAnalysis() {
        console.log("Analysis Submitted for exhibit " + (currentExhibitIndex + 1));
        if (currentPromptDetails && currentPromptDetails.exhibits && currentExhibitIndex < currentPromptDetails.exhibits.length - 1) {
            currentExhibitIndex++;
            doneAsking = false; 
            appendAiChatBubble(`<p class="p-2">Analysis for exhibit ${currentExhibitIndex} received. Moving to exhibit ${currentExhibitIndex + 1}.</p>`);
            displayCurrentPromptAndExhibit(); 
        } else {
            doneAsking = true;
            if(skillActionButtonContainerBar) skillActionButtonContainerBar.innerHTML = '';
            setChipCharacterPose('feedback');
            appendAiChatBubble(`<p class="p-2">Final analysis submitted. CHIP will provide feedback.</p>`);
        }
    }
    function handleSubmitRecommendation() {
        console.log("Recommendation Submitted");
        doneAsking = true;
        if(skillActionButtonContainerBar) skillActionButtonContainerBar.innerHTML = '';
        setChipCharacterPose('feedback');
        appendAiChatBubble(`<p class="p-2">Recommendation submitted. CHIP will provide overall feedback.</p>`);
    }

    function selectNewPromptJS() {
        console.log("selectNewPromptJS called. ALL_PROMPTS length:", ALL_PROMPTS ? ALL_PROMPTS.length : 'undefined');
        if (!ALL_PROMPTS || ALL_PROMPTS.length === 0) {
            console.error("selectNewPromptJS: ALL_PROMPTS is empty or not loaded.");
            setMainBotContentArea(`<p style="color:red; padding:1rem;">Error: Prompts data not available (SNJS-1).</p>`);
            return null;
        }
        const skillPrompts = ALL_PROMPTS.filter(p => p.skill_type === currentSkill);
        if (!skillPrompts.length) {
            console.error("selectNewPromptJS: No prompts found for skill:", currentSkill);
            setMainBotContentArea(`<p style="color:red; padding:1rem;">Error: No prompts found for ${currentSkill}.</p>`);
            return null;
        }
        const randomIndex = Math.floor(Math.random() * skillPrompts.length);
        currentPromptId = skillPrompts[randomIndex].id;
        console.log("selectNewPromptJS: Selected prompt ID:", currentPromptId, "for skill:", currentSkill);
        return currentPromptId;
    }

    function getPromptDetailsJS(promptIdToFetch) {
        console.log("getPromptDetailsJS called for ID:", promptIdToFetch);
        if (!ALL_PROMPTS) {
            console.error("getPromptDetailsJS: ALL_PROMPTS not loaded.");
            setMainBotContentArea(`<p style="color:red; padding:1rem;">Error: Prompts data not available for details (GPDJS-1).</p>`);
            return null;
        }
        const details = ALL_PROMPTS.find(p => p.id === promptIdToFetch);
        if (details) {
            console.log("getPromptDetailsJS: Found details for prompt ID", promptIdToFetch);
        } else {
            console.error("getPromptDetailsJS: No details found for prompt ID", promptIdToFetch);
            setMainBotContentArea(`<p style="color:red; padding:1rem;">Error: Could not find details for prompt ID ${promptIdToFetch}.</p>`);
        }
        return details;
    }
    
    function buildMessagesArrayForAPI(userInput) {
        const prompt = currentPromptDetails;
        if (!prompt) {
            console.error("buildMessagesArrayForAPI: currentPromptDetails is null!");
            return [{ role: "system", content: "Error: Prompt details missing." }, { role: "user", content: userInput }];
        }

        let systemMessageContent = "";
        let userMessageContent = "";
        let apiMessages = [];

        switch(currentSkill) {
            case 'Clarifying':
                systemMessageContent = `Case Prompt: ${prompt.prompt_text}. Candidate is asking a clarifying question. Provide a concise answer or ask for refinement.`;
                userMessageContent = `Clarifying question: ${userInput}`;
                break;
            case 'Hypothesis':
                systemMessageContent = `Case Prompt: ${prompt.prompt_text}. Candidate is proposing a hypothesis. Provide a contradicting data point or ask for a clearer hypothesis. History: ${conversationHistory.filter(m=>m.role !== 'system').map(m => `${m.role === 'user' ? 'Candidate' : 'Interviewer'}: ${m.content}`).join('\n')}`;
                userMessageContent = `Hypothesis: ${userInput}`;
                hypothesisCount++;
                break;
            case 'Frameworks':
                systemMessageContent = `Case Prompt: ${prompt.prompt_text}. Candidate is proposing a framework. Evaluate for MECE, relevance, and provide feedback.`;
                userMessageContent = `Framework: ${userInput}`;
                break;
            case 'Analysis':
                const exhibit = prompt.exhibits ? prompt.exhibits[currentExhibitIndex] : null;
                if (!exhibit) { systemMessageContent = "Error: Exhibit data missing."; userMessageContent = userInput; break; }
                const exhibitData = exhibit.chart_type === 'table' ? JSON.stringify(exhibit.data) : (exhibit.summary_text ? exhibit.summary_text.join('\n') : "No summary text.");
                systemMessageContent = `Case Prompt: ${prompt.prompt_text}. Exhibit (${currentExhibitIndex + 1}/${prompt.exhibits.length}): ${exhibit.exhibit_title}. Data: ${exhibitData}. Candidate is providing analysis. Evaluate insights and connection to case.`;
                userMessageContent = `Analysis: ${userInput}`;
                break;
            case 'Recommendation':
                const exhibitsSummary = prompt.exhibits ? prompt.exhibits.map((ex, i) => `Exhibit ${i+1}: ${ex.exhibit_title}`).join(', ') : "None";
                systemMessageContent = `Case Prompt: ${prompt.prompt_text}. Exhibits Summary: ${exhibitsSummary}. Candidate is providing a recommendation. Evaluate based on case, evidence, actionability, risks, next steps.`;
                userMessageContent = `Recommendation: ${userInput}`;
                break;
            default:
                systemMessageContent = prompt.prompt_text || "You are a helpful assistant.";
                userMessageContent = userInput;
        }

        apiMessages.push({ role: "system", content: systemMessageContent });
        conversationHistory.filter(m => m.role !== 'system').forEach(msg => { 
             apiMessages.push({role: msg.role, content: msg.content});
        });
        apiMessages.push({ role: "user", content: userMessageContent });
        
        return apiMessages;
    }

    async function handleSendButtonClick() {
        const userInputText = chatInput.value.trim();
        if (!userInputText) return;

        appendUserChatBubble(userInputText);
        conversationHistory.push({ role: "user", content: userInputText });

        chatInput.value = '';
        setChipCharacterPose('thinking');
        displayTypingIndicatorInMain(); 

        if (!currentPromptDetails) {
            console.error("handleSendButtonClick: currentPromptDetails is not set.");
            const typingIndicatorBubble = Array.from(aiResponseDisplay.querySelectorAll('.ai-bubble-chat')).pop();
            if (typingIndicatorBubble && typingIndicatorBubble.textContent.includes("CHIP is typing...")) {
                typingIndicatorBubble.parentElement.remove();
            }
            appendAiChatBubble("<p style='color:red;'>Error: No active prompt. Please select a skill or reload.</p>");
            setChipCharacterPose('waiting');
            return;
        }
        
        const messagesForApi = buildMessagesArrayForAPI(userInputText);
        console.log("Sending to API:", JSON.stringify(messagesForApi, null, 2));
        
        try {
            const response = await fetch(OPENAI_PROXY_URL, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt_id: currentPromptDetails.id,
                    skill_type: currentSkill,
                    messages: messagesForApi
                })
            });

            console.log("API Response Status:", response.status); 

            const typingIndicatorBubble = Array.from(aiResponseDisplay.querySelectorAll('.ai-bubble-chat')).pop();
            if (typingIndicatorBubble && typingIndicatorBubble.textContent.includes("CHIP is typing...")) {
                typingIndicatorBubble.parentElement.remove(); 
            }

            if (!response.ok) { 
                const errorText = await response.text();
                console.error("API Error Response Text:", errorText);
                throw new Error(`API request failed with status ${response.status}: ${errorText}`);
            }

            const jsonResponse = await response.json();
            console.log("API JSON Response:", jsonResponse); 

            const aiText = jsonResponse.choices?.[0]?.message?.content || jsonResponse.output || `Sorry, I received an unexpected response structure. Raw: ${JSON.stringify(jsonResponse).substring(0,100)}...`;
            
            console.log("Extracted AI Text:", aiText);

            appendAiChatBubble(aiText);
            conversationHistory.push({ role: "assistant", content: aiText });
            setChipCharacterPose('waiting');

            if (currentSkill === "Hypothesis") {
                if (hypothesisCount >= 3 && !doneAsking) {
                    appendAiChatBubble("<p class='mt-2'>You've refined your hypothesis multiple times. Consider clicking 'End Hypothesis Formulation' or provide your final refined hypothesis.</p>");
                    if (skillActionButtonContainerBar && !skillActionButtonContainerBar.querySelector('#end-hypothesis-btn')) { // Check if container exists
                         createSkillActionButton("End Hypothesis Formulation", "end-hypothesis-btn", handleEndHypothesis);
                    }
                } else if (!doneAsking) {
                     if (skillActionButtonContainerBar && !skillActionButtonContainerBar.querySelector('#end-hypothesis-btn')) { // Check if container exists
                        createSkillActionButton("End Hypothesis Formulation", "end-hypothesis-btn", handleEndHypothesis);
                     }
                }
            }

        } catch (err) {
            console.error("API Call Error in catch block:", err);
            const typingIndicatorBubbleOnError = Array.from(aiResponseDisplay.querySelectorAll('.ai-bubble-chat')).pop();
            if (typingIndicatorBubbleOnError && typingIndicatorBubbleOnError.textContent.includes("CHIP is typing...")) {
                typingIndicatorBubbleOnError.parentElement.remove();
            }
            appendAiChatBubble(`<p style="color:red;">Error: ${err.message}. Check console for details.</p>`);
            setChipCharacterPose('waiting');
        }
    }

    if (sendButton) sendButton.addEventListener('click', handleSendButtonClick);
    if (chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleSendButtonClick();} });

    function initializeSkill(skillName) {
        console.log("initializeSkill called for:", skillName);
        currentSkill = skillName; 
        resetSkillState(); 
        updateInstructionsUI(currentSkill); 
        conversationHistory = []; 
        currentExhibitIndex = 0;

        currentPromptId = selectNewPromptJS(); 
        if (currentPromptId) {
            currentPromptDetails = getPromptDetailsJS(currentPromptId);
            if (currentPromptDetails) {
                displayCurrentPromptAndExhibit(); 
                if (currentSkill === "Clarifying" && !doneAsking) createSkillActionButton("End Clarification Questions", "end-clarifying-btn", handleEndClarifying);
                else if (currentSkill === "Hypothesis" && !doneAsking ) createSkillActionButton("End Hypothesis Formulation", "end-hypothesis-btn", handleEndHypothesis);
                else if (currentSkill === "Frameworks" && !doneAsking) createSkillActionButton("Submit Framework", "submit-framework-btn", handleSubmitFramework);
                else if (currentSkill === "Recommendation" && !doneAsking) createSkillActionButton("Submit Recommendation", "submit-recommendation-btn", handleSubmitRecommendation);
            } else {
                 setMainBotContentArea(`<p style="color:red; padding:1rem;">Error: Could not load details (IS-1).</p>`);
            }
        } else {
            updateInstructionsUI(currentSkill); 
            setMainBotContentArea(`<p class="p-4 text-[var(--color-text-medium)]">No case available for '${currentSkill}' at the moment. Try another skill or check back later.</p>`);
        }
        setChipCharacterPose('waiting');
    }

    async function loadPrompts() {
        console.log("loadPrompts: Attempting to load prompts...");
        updateInstructionsUI(currentSkill); 
        setMainBotContentArea(`<p class="p-4 text-[var(--color-text-medium)]">Loading practice cases...</p>`);
        try {
            const response = await fetch(PROMPTS_JSON_URL + '?t=' + new Date().getTime());
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            ALL_PROMPTS = await response.json();
            if (!Array.isArray(ALL_PROMPTS) || ALL_PROMPTS.length === 0) throw new Error("Prompts data invalid.");
            console.log("loadPrompts: Prompts loaded:", ALL_PROMPTS.length);
            
            const activeButton = skillButtons.find(btn => btn.classList.contains('active'));
            currentSkill = activeButton ? activeButton.textContent.trim() : 'Clarifying'; 
            console.log("loadPrompts: Initializing with skill:", currentSkill);
            initializeSkill(currentSkill); 

        } catch (error) {
            console.error("loadPrompts Error:", error);
            setMainBotContentArea(`<p style="color:red; padding:1rem;">Error loading cases: ${error.message}.</p>`);
            updateInstructionsUI(currentSkill); 
            ALL_PROMPTS = [];
        }
    }

    function displayCurrentPromptAndExhibit() {
        if (!mainBotContentWrapper) { console.error("DCP&E: mainBotContentWrapper missing"); return; }
        if (!currentPromptDetails) { setMainBotContentArea(`<p style="color:red;">No prompt details (DCP&E-2).</p>`); return; }

        let mainContentHtml = `<p class="font-semibold text-lg p-4 mb-1" style="color: var(--color-accent-primary);">${currentPromptDetails.title || 'Case Prompt'}</p>`;
        if (currentPromptDetails.prompt_text) {
            currentPromptDetails.prompt_text.split('\n\n').forEach(para => {
                mainContentHtml += `<p class="text-sm px-4 py-2" style="color: var(--color-text-lightest);">${para.replace(/\n/g, '<br>')}</p>`;
            });
        }

        if (currentPromptDetails.exhibits && currentPromptDetails.exhibits.length > 0) {
            const exhibitsToShow = (currentSkill === 'Analysis') ? 
                                    (currentPromptDetails.exhibits[currentExhibitIndex] ? [currentPromptDetails.exhibits[currentExhibitIndex]] : []) 
                                    : currentPromptDetails.exhibits; 

            exhibitsToShow.forEach((exhibit, idx) => {
                 if (!exhibit) return;
                 const exhibitNumberForDisplay = (currentSkill === 'Analysis') ? currentExhibitIndex + 1 : idx + 1;
                 const totalExhibits = currentPromptDetails.exhibits.length;
                 const exhibitTitleSuffix = (currentSkill === 'Analysis' && totalExhibits > 1) ? ` (Exhibit ${exhibitNumberForDisplay} of ${totalExhibits})` : '';

                mainContentHtml += `<div class="exhibit-container mx-4 mb-4">`; 
                mainContentHtml += `<p class="font-semibold text-base mb-1" style="color: var(--color-accent-primary);">${exhibit.exhibit_title || `Exhibit ${exhibitNumberForDisplay}`}${exhibitTitleSuffix}</p>`;
                if (exhibit.description) {
                    mainContentHtml += `<p class="text-xs mb-1" style="color: var(--color-text-dark);">${exhibit.description.replace(/\n/g, '<br>')}</p>`;
                }
                if (exhibit.chart_type === 'table' && exhibit.data) {
                    mainContentHtml += '<div class="overflow-x-auto"><table class="w-full text-sm text-left" style="color: var(--color-text-lightest);">';
                    const headers = Object.keys(exhibit.data);
                    if (headers.length > 0 && Array.isArray(exhibit.data[headers[0]]) && exhibit.data[headers[0]].length > 0) {
                        mainContentHtml += '<thead class="text-xs uppercase" style="color: var(--color-text-medium);"><tr>';
                        headers.forEach(header => mainContentHtml += `<th scope="col" class="py-1 px-2 ${ (typeof exhibit.data[header][0] === 'number' || header.includes('%') || header.includes('$')) ? 'text-right' : 'text-left'} whitespace-nowrap">${header}</th>`);
                        mainContentHtml += '</tr></thead><tbody>';
                        const numRows = exhibit.data[headers[0]].length;
                        for (let i = 0; i < numRows; i++) {
                            mainContentHtml += `<tr class="border-b" style="border-color: var(--color-border);">`;
                            headers.forEach(header => mainContentHtml += `<td class="py-1 px-2 ${ (typeof exhibit.data[header][i] === 'number' || header.includes('%') || header.includes('$')) ? 'text-right' : 'text-left'} whitespace-nowrap">${exhibit.data[header][i]}</td>`);
                            mainContentHtml += `</tr>`;
                        }
                        mainContentHtml += '</tbody></table></div>';
                    } else { mainContentHtml += '<p class="text-xs text-[var(--color-text-medium)]">Table data is malformed or empty.</p>'; }
                } else if (exhibit.summary_text) {
                    if (Array.isArray(exhibit.summary_text)) {
                        mainContentHtml += '<ul class="list-disc list-inside pl-4 text-sm" style="color: var(--color-text-medium);">';
                        exhibit.summary_text.forEach(itemText => mainContentHtml += `<li>${itemText}</li>`);
                        mainContentHtml += '</ul>';
                    } else {
                        mainContentHtml += `<p class="text-sm" style="color: var(--color-text-medium);">${exhibit.summary_text.replace(/\n/g, '<br>')}</p>`;
                    }
                } else if (exhibit.chart_type && exhibit.chart_type !== 'table' && exhibit.data) {
                    mainContentHtml += `<div id="plotly-chart-exhibit-${exhibitNumberForDisplay}" class="mt-2 w-full"></div>`;
                }
                mainContentHtml += `</div>`;
            });
        }
        setMainBotContentArea(mainContentHtml);

        if (currentPromptDetails.exhibits && currentPromptDetails.exhibits.length > 0) {
            const exhibitsToRender = (currentSkill === 'Analysis') ? 
                                    (currentPromptDetails.exhibits[currentExhibitIndex] ? [currentPromptDetails.exhibits[currentExhibitIndex]] : []) 
                                    : currentPromptDetails.exhibits; 
            exhibitsToRender.forEach((exhibit, idx) => {
                 if (!exhibit) return;
                 const exhibitNumberForDisplay = (currentSkill === 'Analysis') ? currentExhibitIndex + 1 : idx + 1;
                 if (exhibit.chart_type && exhibit.chart_type !== 'table' && exhibit.data && typeof Plotly !== 'undefined') {
                     if(document.getElementById(`plotly-chart-exhibit-${exhibitNumberForDisplay}`)){
                        renderPlotlyChart(exhibit, exhibitNumberForDisplay);
                     } else {
                        console.warn(`Chart div plotly-chart-exhibit-${exhibitNumberForDisplay} not found for rendering.`);
                     }
                 }
            });
        }

        if (currentSkill === "Analysis" && !doneAsking) {
            const buttonText = (currentPromptDetails.exhibits && currentPromptDetails.exhibits.length > 0 && currentExhibitIndex < currentPromptDetails.exhibits.length - 1) ?
                               "Submit Analysis & Next Exhibit" : "Submit Final Analysis";
            createSkillActionButton(buttonText, "submit-analysis-btn", handleSubmitAnalysis);
        }
    }

    function renderPlotlyChart(exhibit, exhibitNumber) {
        const chartDivId = `plotly-chart-exhibit-${exhibitNumber}`;
        const chartDiv = document.getElementById(chartDivId);
        if (!chartDiv) { console.error("renderPlotlyChart: Chart div not found for exhibit:", exhibitNumber, exhibit.exhibit_title); return; }
        
        Plotly.purge(chartDivId); 

        let plotData = [];
        let layout = {
            title: { 
                text: exhibit.exhibit_title || `Exhibit ${exhibitNumber}`, 
                x: 0.05, 
                font: { color: 'var(--color-text-lightest)'}
            },
            paper_bgcolor: 'var(--color-bg-darkest)',
            plot_bgcolor: 'var(--color-bg-darkest)',
            font: { color: 'var(--color-text-lightest)' },
            xaxis: {
                title: { text: exhibit.x_axis || '', font: {color: 'var(--color-text-medium)'}},
                gridcolor: 'var(--color-border)',
                tickfont: {color: 'var(--color-text-medium)'}
            },
            yaxis: {
                title: { text: Array.isArray(exhibit.y_axis) ? exhibit.y_axis.join(', ') : exhibit.y_axis || '', font: {color: 'var(--color-text-medium)'}},
                gridcolor: 'var(--color-border)',
                tickfont: {color: 'var(--color-text-medium)'},
                automargin: true
            },
            legend: { 
                font: { color: 'var(--color-text-lightest)'}, 
                orientation: 'h', yanchor: 'bottom', y: 1.02, xanchor: 'right', x:1
            },
            margin: { l: 60, r: 30, t: 80, b: 70 },
            autosize: true 
        };

        try {
            if (exhibit.chart_type === 'bar' && exhibit.data && exhibit.x_axis && exhibit.y_axis) {
                const xValues = exhibit.data[exhibit.x_axis];
                (Array.isArray(exhibit.y_axis) ? exhibit.y_axis : [exhibit.y_axis]).forEach((yKey, index) => {
                    plotData.push({ x: xValues, y: exhibit.data[yKey], type: 'bar', name: yKey, marker: {color: index % 2 === 0 ? 'var(--color-accent-primary)' : 'var(--color-accent-secondary)'} });
                });
                layout.barmode = 'group';
            } else if (exhibit.chart_type === 'line' && exhibit.data && exhibit.x_axis && exhibit.y_axis) {
                const xValues = exhibit.data[exhibit.x_axis];
                (Array.isArray(exhibit.y_axis) ? exhibit.y_axis : [exhibit.y_axis]).forEach((yKey, index) => {
                    plotData.push({ x: xValues, y: exhibit.data[yKey], type: 'scatter', mode: 'lines+markers', name: yKey, line: {color: index % 2 === 0 ? 'var(--color-accent-primary)' : 'var(--color-accent-secondary)'} });
                });
            } else if (exhibit.chart_type === 'pie' && exhibit.data && exhibit.names && exhibit.values) {
                plotData.push({ labels: exhibit.data[exhibit.names], values: exhibit.data[exhibit.values], type: 'pie', hole: 0.4, marker: { colors: [ 'var(--color-accent-primary)', 'var(--color-accent-secondary)', '#FFBF00', '#4A3B31', '#6B7280', '#F56565', '#ED8936', '#48BB78', '#38B2AC', '#4299E1']}, textinfo: "label+percent", insidetextorientation: "radial" });
                layout.showlegend = true; 
            } else {
                 console.warn("Unsupported or misconfigured chart type for Plotly:", exhibit.chart_type, exhibit);
            }
            
            if (plotData.length > 0) {
                Plotly.newPlot(chartDivId, plotData, layout, {responsive: true, displaylogo: false});
            } else {
                chartDiv.innerHTML = `<p class="text-sm p-2" style="color: var(--color-text-medium);">Could not render chart: '${exhibit.chart_type}'. Data might be missing or misconfigured.</p>`;
            }
        } catch (e) {
            console.error("Error rendering Plotly chart:", e, "Exhibit data:", exhibit);
            chartDiv.innerHTML = `<p class="text-sm p-2" style="color:red;">Error rendering chart. Check console.</p>`;
        }
    }

    if (skillButtons.length > 0) {
        skillButtons.forEach(button => {
            button.addEventListener('click', () => {
                skillButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                currentSkill = button.textContent.trim(); 
                initializeSkill(currentSkill);
            });
        });
    } else {
        console.error("No skill buttons found.");
    }

    console.log("DOM fully loaded. Starting app initialization.");
    loadPrompts(); 
});
