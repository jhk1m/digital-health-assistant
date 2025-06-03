document.addEventListener('DOMContentLoaded', () => {
    const healthForm = document.getElementById('healthForm');
    const diagnosticView = document.getElementById('diagnosticView');
    const diagnosticList = document.getElementById('diagnosticList');
    const submitButton = healthForm.querySelector('button[type="submit"]');

    // MODIFIED: Make sub-question listeners conditional
    const coughInput = document.querySelector('input[name="cough"]');
    if (coughInput) { // Only add listener if the element exists
        coughInput.addEventListener('change', function() {
            document.getElementById('cough-type').style.display = this.checked ? 'block' : 'none';
        });
    }

    const phlegmInput = document.querySelector('input[name="phlegm"]');
    if (phlegmInput) { // Only add listener if the element exists
        phlegmInput.addEventListener('change', function() {
            document.getElementById('phlegm-details').style.display = this.checked ? 'block' : 'none';
        });
    }

    // MODIFIED: Add sub-question listeners for new questionnaire types (e.g., arthritis)
    const jointPainInput = document.querySelector('input[name="jointPain"]');
    if (jointPainInput) {
        jointPainInput.addEventListener('change', function() {
            document.getElementById('jointPain-details').style.display = this.checked ? 'block' : 'none';
        });
    }

    const jointSwellingInput = document.querySelector('input[name="jointSwelling"]');
    if (jointSwellingInput) {
        jointSwellingInput.addEventListener('change', function() {
            document.getElementById('jointSwelling-details').style.display = this.checked ? 'block' : 'none';
        });
    }


    healthForm.addEventListener('submit', async function(event) {
        event.preventDefault(); // Prevent default form submission

        // Clear previous results and hide view
        diagnosticList.innerHTML = '';
        diagnosticView.style.display = 'none';
        submitButton.disabled = true; // Disable button during processing
        submitButton.textContent = '진단 생성 중... (Generating Diagnosis...)';

        const answers = {};
        let hasMeaningfulSymptoms = false; // Flag to check if any meaningful input was given

        // Initialize all fields with default 'no' or empty string
        // This is a comprehensive list of ALL possible fields across ALL questionnaires
        const allFormElements = [
            'specialtyType',
            'throatIrritation', 'throatPain', 'dryThroat', 'hoarseVoice', 'wornOutVoice', 'recentVoiceChange',
            'cough', 'coughType', 'phlegm', 'phlegmColor', 'phlegmConsistency',
            'difficultySwallowing', 'shortnessOfBreath', 'chestTightness', 'weightLoss', 'earPain', 'neckLump',
            'heartburn', 'sourTaste', 'regurgitation', 'worseAfterEating', 'worseLyingDown',
            'otherConcerns',
            // General Health Specific Fields
            'currentAge', 'gender', 'heightCm', 'weightKg', 'fatigue', 'unexplainedWeightChange', 'sleepIssues',
            'appetiteChange', 'digestionIssues', 'headaches', 'dizziness', 'skinChanges', 'existingConditions',
            'currentMedications', 'allergies',
            // Arthritis/Joints Specific Fields
            'jointPain', 'affectedJoints', 'painCharacter', 'painWorse', 'jointSwelling', 'swollenJoints',
            'jointStiffness', 'jointRednessWarmth', 'jointCrepitus', 'muscleWeakness', 'skinRash',
            'eyeDryness', 'familyHistoryArthritis'
        ];
        allFormElements.forEach(name => {
            answers[name] = 'no'; // Default for checkboxes/radios
            // Specific defaults for select/textarea/number fields
            if (['coughType', 'phlegmColor', 'phlegmConsistency', 'specialtyType', 'gender', 'painCharacter', 'painWorse'].includes(name)) {
                answers[name] = '';
            }
            if (['otherConcerns', 'existingConditions', 'currentMedications', 'allergies', 'affectedJoints', 'swollenJoints', 'familyHistoryArthritis'].includes(name)) {
                answers[name] = '';
            }
            if (['currentAge', 'heightCm', 'weightKg'].includes(name)) {
                answers[name] = ''; // Number fields, initialize as empty string
            }
        });

        // Iterate through form elements to update the answers based on user input
        Array.from(this.elements).forEach(element => {
            if (element.name && element.name !== 'submit') {
                if (element.type === 'checkbox') {
                    if (element.checked) {
                        answers[element.name] = element.value;
                        hasMeaningfulSymptoms = true;
                    } else {
                         answers[element.name] = 'no';
                    }
                } else if (element.type === 'radio' && element.checked) {
                    answers[element.name] = element.value;
                    hasMeaningfulSymptoms = true;
                } else if (element.tagName === 'SELECT') {
                    if (element.value && element.value !== '') {
                        answers[element.name] = element.value;
                        hasMeaningfulSymptoms = true;
                    } else {
                        answers[element.name] = '';
                    }
                } else if (element.tagName === 'TEXTAREA' || element.type === 'text' || element.type === 'number') { // <--- Added handling for text, number inputs
                    answers[element.name] = element.value.trim();
                    if (element.value.trim() !== '') {
                        hasMeaningfulSymptoms = true;
                    }
                } else if (element.type === 'hidden' && element.name === 'specialtyType') {
                    answers[element.name] = element.value;
                }
            }
        });

        // Ensure specialtyType is correctly captured and required
        if (!answers.specialtyType || answers.specialtyType === '') {
            diagnosticList.innerHTML = '<li>시스템 오류: 상담 유형이 지정되지 않았습니다. 페이지를 새로고침하거나 올바른 경로로 접근해 주세요. (System Error: Consultation type not specified. Please refresh the page or access via the correct path.)</li>';
            diagnosticView.style.display = 'block';
            submitButton.disabled = false;
            submitButton.textContent = '결과 확인 (Check Results)';
            return;
        }

        const hasPrimarySymptomsOrConcerns = Object.keys(answers).some(key => {
            if (key === 'specialtyType') return false; // Exclude specialtyType from symptom check

            // Check for explicit 'yes' answers from checkboxes
            if (['throatIrritation', 'throatPain', 'dryThroat', 'hoarseVoice', 'wornOutVoice', 'recentVoiceChange', 'cough', 'phlegm', 'difficultySwallowing', 'shortnessOfBreath', 'chestTightness', 'weightLoss', 'earPain', 'neckLump', 'heartburn', 'sourTaste', 'regurgitation', 'worseAfterEating', 'worseLyingDown', 'fatigue', 'unexplainedWeightChange', 'sleepIssues', 'appetiteChange', 'digestionIssues', 'headaches', 'dizziness', 'skinChanges', 'jointPain', 'jointSwelling', 'jointStiffness', 'jointRednessWarmth', 'jointCrepitus', 'muscleWeakness', 'skinRash', 'eyeDryness'].includes(key) && answers[key] === 'yes') {
                return true;
            }
            // Check for non-empty values from selects, text inputs, textareas, and numbers
            if (['coughType', 'phlegmColor', 'phlegmConsistency', 'currentAge', 'gender', 'heightCm', 'weightKg', 'existingConditions', 'currentMedications', 'allergies', 'affectedJoints', 'painCharacter', 'painWorse', 'swollenJoints', 'familyHistoryArthritis', 'otherConcerns'].includes(key) && answers[key] !== '' && answers[key] !== 'no') {
                return true;
            }
            return false;
        });

        if (!hasPrimarySymptomsOrConcerns) {
            diagnosticList.innerHTML = '<li>진단에는 최소 하나의 의미 있는 증상 선택 또는 기타 우려 사항 작성이 필요합니다. (At least one meaningful symptom selection or other concern entry is required for diagnosis.)</li>';
            diagnosticView.style.display = 'block';
            submitButton.disabled = false;
            submitButton.textContent = '결과 확인 (Check Results)';
            return;
        }

        console.log('Sending answers:', answers);

        try {
            const response = await fetch('/generate-diagnostic', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(answers)
            });

            if (!response.ok) {
                const errorData = await response.json();
                const customError = new Error(errorData.error || response.statusText || '알 수 없는 오류 (Unknown error)');
                customError.status = response.status;
                customError.details = errorData.details;
                throw customError;
            }

            const result = await response.json();
            console.log('AI Response:', result.diagnosticResult);

            if (result.diagnosticResult) {
                const lines = result.diagnosticResult.split('\n');
                lines.forEach(line => {
                    if (line.trim() !== '') {
                        const listItem = document.createElement('li');
                        let cleanLine = line.replace(/^(#+\s*|\*+\s*|-\s*)/, '');
                        listItem.textContent = cleanLine;
                        diagnosticList.appendChild(listItem);
                    }
                });
                diagnosticView.style.display = 'block';
            } else {
                const listItem = document.createElement('li');
                listItem.textContent = 'AI로부터 유효한 진단 결과를 받지 못했습니다. (No valid diagnostic result received from AI.)';
                diagnosticList.appendChild(listItem);
                diagnosticView.style.display = 'block';
            }

        } catch (error) {
            console.error('Error during AI diagnosis:', error);
            const listItem = document.createElement('li');
            let displayMessage = `진단 생성 중 알 수 없는 오류가 발생했습니다. (An unknown error occurred during diagnosis.)`;

            if (error.status) {
                if (error.status === 429) {
                    displayMessage = `API 사용량 초과 (HTTP 429): 잠시 후 다시 시도해 주세요. (API quota exceeded: Please try again after some time.)`;
                } else if (error.status >= 500 && error.status < 600) {
                    displayMessage = `서버 내부 오류 (HTTP ${error.status}): 관리자에게 문의하거나 잠시 후 다시 시도해 주세요. (Internal Server Error: Please contact the administrator or try again later.)`;
                } else {
                    displayMessage = `네트워크 오류 또는 기타 문제 (HTTP ${error.status}): 요청 처리 중 문제가 발생했습니다. (Network error or other issue: A problem occurred while processing the request.)`;
                }
            }
            if (error.message && error.message !== '알 수 없는 오류 (Unknown error)') {
                displayMessage += ` [오류 상세: ${error.message}]`;
            }
            if (error.details) {
                displayMessage += ` [개발자 상세: ${error.details}]`;
            }


            listItem.textContent = displayMessage;
            diagnosticList.appendChild(listItem);
            diagnosticView.style.display = 'block';
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = '결과 확인 (Check Results)';
        }
    });
});