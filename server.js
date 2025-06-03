require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } = require('@google/generative-ai');

const app = express();
const port = 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set in .env file!');
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); // Using the available model

app.use(cors());
app.use(bodyParser.json());

app.post('/generate-diagnostic', async (req, res) => {
    let answers = req.body;

    const specialtyType = answers.specialtyType;
    if (!specialtyType) {
        return res.status(400).json({ error: 'Consultation specialty not provided.' });
    }
    delete answers.specialtyType; // Remove specialtyType from answers object

    let personaContext = "";
    let personaTask = "";
    let systemContext = `70대 고령 환자입니다.`; // Default, very general context.
    let specialtySpecificInstructions = "";
    let pageTitleForAI = "";
    let generalCareContext = ""; // NEW: Define placeholder for general care context

    // --- Define RELEVANT SYMPTOM KEYS for each specialty ---
    const specialtyRelevantKeys = {
        'respiratory': [
            'throatIrritation', 'throatPain', 'dryThroat', 'hoarseVoice', 'wornOutVoice', 'recentVoiceChange',
            'cough', 'coughType', 'phlegm', 'phlegmColor', 'phlegmConsistency',
            'difficultySwallowing', 'shortnessOfBreath', 'chestTightness', 'weightLoss', 'earPain', 'neckLump',
            'heartburn', 'sourTaste', 'regurgitation', 'worseAfterEating', 'worseLyingDown', 'otherConcerns'
        ],
        'general_health': [
            'currentAge', 'gender', 'heightCm', 'weightKg', 'fatigue', 'unexplainedWeightChange', 'sleepIssues',
            'appetiteChange', 'digestionIssues', 'headaches', 'dizziness', 'skinChanges',
            'existingConditions', 'currentMedications', 'allergies', 'otherConcerns'
        ],
        'arthritis_joints': [
            'jointPain', 'affectedJoints', 'painCharacter', 'painWorse', 'jointSwelling', 'swollenJoints',
            'jointStiffness', 'jointRednessWarmth', 'jointCrepitus', 'muscleWeakness', 'skinRash',
            'eyeDryness', 'familyHistoryArthritis', 'otherConcerns'
        ]
    };

    switch (specialtyType) {
        case 'respiratory':
            personaContext = "호흡기계 질환 전문의로서 민감한 호흡기계를 가진 환자를 수십 년간 치료해 온 경험이 있는 전문가처럼 행동하십시오.";
            personaTask = "냉정하고, 사실에 기반하며, 간결한 의료 진단 개요를 제공하십시오. 비판적인 사례를 검토하듯이 접근하십시오. 안심시키거나 불필요한 친절은 피하십시오. 가정을 단정 짓지 말고 의문을 제기하십시오. 감정적인 표현보다는 사실, 논리, 추론을 우선하십시오. 출력은 의료 전문가를 위한 것이며, 진단 및 조치 중심이어야 합니다.";
            systemContext = `70대 고령 환자로 민감한 호흡기계 병력을 가지고 있습니다.`;
            pageTitleForAI = "호흡기 건강 상담 설문";
            generalCareContext = "고령 환자의 민감한 호흡기계 상황에서 증상 완화 또는 악화 방지에 도움이 될 수 있는"; // MODIFIED: Specific context for respiratory care
            break;
        case 'general_health':
            personaContext = "종합 건강 검진 의사로서 다양한 연령대의 환자들을 진료해 온 경험이 풍부한 일반 건강 의사처럼 행동하십시오.";
            personaTask = "포괄적이고 사실에 기반한 건강 상담 개요를 제공하십시오. 특정 문제에 대한 통찰력과 함께 전반적인 건강 상태에 대한 관점을 제시하십시오. 불필요한 전문 용어 사용은 피하고, 간결하고 명확하게 전달하십시오.";
            systemContext = `70대 고령 환자로 전반적인 건강 상태에 대한 상담을 요청했습니다.`;
            pageTitleForAI = "일반 건강 상담 설문";
            generalCareContext = "고령 환자의 전반적인 건강 유지 및 증상 관리에 도움이 될 수 있는"; // MODIFIED: General context for care
            specialtySpecificInstructions = `
            2.  **주요 건강 문제 및 감별 진단:**
                * 보고된 증상을 바탕으로 주요 건강 문제와 가능한 감별 진단을 제시하십시오. 각 문제에 대한 간략한 설명을 포함하십시오.
            3.  **전반적인 건강 평가:**
                * 환자의 연령대를 고려하여 전반적인 건강 상태에 대한 통찰력을 제공하십시오.
                * 만성 질환 관리 및 예방에 대한 일반적인 조언을 포함하십시오.
            `;
            break;
        case 'arthritis_joints':
            personaContext = "관절 및 류마티스 질환 전문의로서 수십 년간 다양한 관절 및 류마티스 질환 환자들을 치료해 온 경험이 있는 전문가처럼 행동하십시오.";
            personaTask = "관절 및 류마티스 문제에 초점을 맞춰 냉정하고, 사실에 기반하며, 간결한 의료 진단 개요를 제공하십시오. 비판적인 사례를 검토하듯이 접근하십시오. 안심시키거나 불필요한 친절은 피하십시오. 가정을 단정 짓지 말고 의문을 제기하십시오. 감정적인 표현보다는 사실, 논리, 추론을 우선하십시오. 출력은 의료 전문가를 위한 것이며, 진단 및 조치 중심이어야 합니다.";
            systemContext = `70대 고령 환자로 관절 및 류마티스 관련 증상을 보고했습니다.`;
            pageTitleForAI = "관절 및 류마티스 질환 상담 설문";
            generalCareContext = "고령 환자의 관절 건강 및 증상 관리에 도움이 될 수 있는"; // MODIFIED: Specific context for arthritis care
            specialtySpecificInstructions = `
            2.  **주요 관절 및 류마티스 감별 진단:**
                * 보고된 증상만을 기반으로 가장 가능성 있는 관절 및 류마티스 질환들을 나열하십시오. 각 질환에 대해 보고된 특정 증상과 직접적으로 연결되는 간결하고 논리적인 설명을 제공하십시오.
                * 각 질환에 대해 의료 전문가가 *반드시* 취해야 할 구체적이고 필수적인 다음 진단 조치(예: "류마티스 전문의 의뢰", "관절 X-ray/MRI", "특정 혈액 검사(염증 표지자)")를 나열하십시오.
            `;
            break;
        default:
            return res.status(400).json({ error: 'Invalid specialty type selected.' });
    }

    let symptomListForAI = ``;
    let hasMeaningfulSymptoms = false;

    const symptomMapping = {
        'throatIrritation': '목이 칼칼하거나 따끔거리는 불편함',
        'throatPain': '목 통증',
        'dryThroat': '목 건조함',
        'hoarseVoice': '목소리 쉼 또는 갈라짐',
        'wornOutVoice': '목소리가 "지쳐 보임" 또는 힘이 없음',
        'recentVoiceChange': '최근 목소리 변화',
        'cough': '기침',
        'coughType': '기침 종류',
        'phlegm': '가래',
        'phlegmColor': '가래 색깔',
        'phlegmConsistency': '가래 농도',
        'difficultySwallowing': '삼키기 어려움 또는 목 이물감',
        'shortnessOfBreath': '숨참 또는 쌕쌕거림',
        'chestTightness': '가슴 답답함 또는 불편함',
        'weightLoss': '이유 없는 체중 감소',
        'earPain': '귀 통증',
        'neckLump': '목 멍울 또는 부종',
        'heartburn': '속쓰림',
        'sourTaste': '입에서 신맛',
        'regurgitation': '신물/음식물 역류',
        'worseAfterEating': '식후 증상 악화',
        'worseLyingDown': '누우면 증상 악화',
        'currentAge': '현재 나이',
        'gender': '성별',
        'heightCm': '키 (cm)',
        'weightKg': '체중 (kg)',
        'fatigue': '최근 피로감 심함',
        'unexplainedWeightChange': '의도치 않은 체중 변화',
        'sleepIssues': '수면 문제',
        'appetiteChange': '식욕 변화',
        'digestionIssues': '소화기 문제 (소화 불량, 변비, 설사 등)',
        'headaches': '두통 빈번',
        'dizziness': '어지럼증',
        'skinChanges': '피부 변화 (발진, 가려움증 등)',
        'existingConditions': '진단받은 기존 질환',
        'currentMedications': '현재 복용 중인 약물',
        'allergies': '알레르기',
        'jointPain': '관절 통증',
        'affectedJoints': '아픈 관절',
        'painCharacter': '통증 특징',
        'painWorse': '통증 심화 시기',
        'jointSwelling': '관절 부종',
        'swollenJoints': '부은 관절',
        'jointStiffness': '관절 뻣뻣함',
        'jointRednessWarmth': '관절 부위 붉거나 열감',
        'jointCrepitus': '관절에서 소리 (삐걱거림, 뚝뚝거림)',
        'muscleWeakness': '근육 약화 또는 통증',
        'skinRash': '피부 발진 (관절 문제와 함께)',
        'eyeDryness': '눈 건조증 또는 구강 건조증',
        'familyHistoryArthritis': '가족 중 관절염 또는 류마티스 질환 병력',
        'otherConcerns': '기타 우려 사항 또는 질문'
    };

    const currentSpecialtyKeys = specialtyRelevantKeys[specialtyType] || [];
    const filteredAnswers = {};
    for (const key of currentSpecialtyKeys) {
        if (answers.hasOwnProperty(key)) {
            filteredAnswers[key] = answers[key];
        }
    }

    for (const key in filteredAnswers) {
        const label = symptomMapping[key];
        let value = filteredAnswers[key];
        let displayValue = '';

        if (value === 'yes') {
            displayValue = '예';
            hasMeaningfulSymptoms = true;
        } else if (value === 'no') {
            displayValue = '아니오';
        }
        else if (key === 'coughType') {
            displayValue = value === 'dry' ? '마른 기침' : (value === 'phlegm' ? '가래 기침' : '기침 종류 미확인');
            if (value !== '') hasMeaningfulSymptoms = true;
        } else if (key === 'phlegmColor') {
            displayValue = value === 'white' ? '하얀색' : (value === 'yellow' ? '노란색' : (value === 'green' ? '초록색' : '가래 색깔 미확인'));
            if (value !== '') hasMeaningfulSymptoms = true;
        } else if (key === 'phlegmConsistency') {
            displayValue = value === 'thin' ? '묽은 가래' : (value === 'thick' ? '끈적한 가래' : '가래 농도 미확인');
            if (value !== '') hasMeaningfulSymptoms = true;
        }
        else if (key === 'gender') {
            displayValue = value === 'male' ? '남성' : (value === 'female' ? '여성' : '기타');
            if (value !== '') hasMeaningfulSymptoms = true;
        } else if (key === 'painCharacter') {
            switch(value) {
                case 'dull_ache': displayValue = '둔한 통증'; break;
                case 'sharp_stabbing': displayValue = '찌르는 듯한 통증'; break;
                case 'burning': displayValue = '타는 듯한 통증'; break;
                case 'throbbing': displayValue = '욱신거리는 통증'; break;
                case 'other_pain_character': displayValue = '기타 (통증 특징)'; break;
                default: displayValue = '통증 특징 미확인';
            }
            if (value !== '') hasMeaningfulSymptoms = true;
        } else if (key === 'painWorse') {
            switch(value) {
                case 'morning_stiffness': displayValue = '아침에 뻣뻣함'; break;
                case 'activity': displayValue = '활동 시'; break;
                case 'rest': displayValue = '휴식 시'; break;
                case 'cold_damp': displayValue = '춥거나 습할 때'; break;
                case 'night': displayValue = '밤에'; break;
                default: displayValue = '통증 심화 시기 미확인';
            }
            if (value !== '') hasMeaningfulSymptoms = true;
        }
        else if (['currentAge', 'heightCm', 'weightKg'].includes(key)) {
            displayValue = value !== '' ? String(value) : '미응답';
            if (value !== '') hasMeaningfulSymptoms = true;
        }
        else if (['otherConcerns', 'existingConditions', 'currentMedications', 'allergies', 'affectedJoints', 'swollenJoints', 'familyHistoryArthritis'].includes(key)) {
            displayValue = value.trim() !== '' ? `"${value.trim()}"` : '내용 없음';
            if (value.trim() !== '') hasMeaningfulSymptoms = true;
        }
        else {
            displayValue = String(value);
            if (value !== '' && value !== 'no') hasMeaningfulSymptoms = true;
        }
        symptomListForAI += `- ${label}: ${displayValue}\n`;
    }

    let prompt = `
    Context: ${systemContext}
    Task: ${personaContext} ${personaTask}

    환자 응답:
    ${symptomListForAI}

    `;

    if (!hasMeaningfulSymptoms) {
        prompt += `**중요 참고:** 설문에서 의미 있는 증상이 보고되지 않았습니다. 모든 질문에 '아니오' 또는 '응답 없음'으로 답했습니다.\n\n`;
        prompt += `**하지만, 고령 환자의 경우 증상이 비정형적으로 나타나거나 경미할 수 있으므로, 증상이 없더라도 절대적인 건강 상태를 보장하지 않습니다. 의료 전문가의 직접적인 평가가 필수적입니다.**\n\n`;
        prompt += `**필수적인 다음 단계:** 의료 전문가는 증상 유무와 관계없이 고령 환자의 전반적인 건강 상태 및 기저 질환 평가를 위해 포괄적인 진찰을 실시해야 합니다.\n\n`;
    } else {
        prompt += `
        진단 평가 전략:
        1.  **즉각적인 경고 신호 / 주요 우려 사항:**
            * 보고된 증상 중 즉각적인 의료적 조치가 필요한 경우를 식별하고, 해당 증상이 나타내는 중요한 기저 질환을 설명하십시오.
            * 신속하게 해결되지 않을 경우 발생할 수 있는 잠재적인 문제점이나 비효율성을 지적하십시오.
        `;
        if (specialtySpecificInstructions) {
            prompt += specialtySpecificInstructions;
        } else {
            prompt += `
        2.  **주요 감별 진단:**
            * 보고된 증상만을 기반으로 가장 가능성 있는 질환들을 나열하십시오. 각 질환에 대해 보고된 특정 증상과 직접적으로 연결되는 간결하고 논리적인 설명을 제공하십시오.
            * 각 질환에 대해 의료 전문가가 *반드시* 취해야 할 구체적이고 필수적인 다음 진단 조치(예: "후두경 검사를 위한 이비인후과 의뢰", "흉부 X-ray", "특정 혈액 검사", "pH 측정")를 나열하십시오.
            `;
        }

        prompt += `
        3.  **고령층 특이 사항:**
            * 고령층에서 이러한 증상이 다르게 나타나거나 더 심각할 수 있는 방식을 설명하십시오 (예: 비정형적 발현, 생리적 예비력 감소, 합병증 취약성 증가).
            * 이 연령대에 특정한 증가된 위험이나 잠재적 합병증(예: 흡인성 폐렴 위험 증가, 다약제 복용 효과, 회복 지연)을 강조하십시오.
            * 고령 환자의 진단 명확성 또는 치료 접근법에 대한 특정 고려 사항을 언급하십시오.
        4.  **일반적 관리 및 주의사항:**
            * **중요 면책 조항: 이 항목은 일반적인 지침이며, 의료적 조언이나 진단을 대체하지 않습니다. 모든 건강 관련 결정은 반드시 자격을 갖춘 의료 전문가와 상의해야 합니다.**
            * ${generalCareContext} 간결하고 증거 기반의 일반적인 주의사항 또는 보조적 관리 방법을 제공하십시오. (예: 충분한 수분 섭취, 연기/먼지 등 알려진 자극물 피하기, 공기 가습, 역류를 위한 수면 중 머리 높이기, 적절한 식단 및 영양 섭취, 약물 부작용 검토). 구체적인 치료법이나 처방은 피하십시오.
        5.  **잠재적 맹점 / 누락:**
            * 포괄적인 진단에 필수적이거나 현재 평가를 크게 바꿀 수 있는, 설문에서 제공되지 않은 중요한 정보나 증상을 지적하십시오.
            * 어떤 세부 정보가 누락되었으며 왜 중요한지 명시하십시오.
        6.  **기타 우려 사항 분석:**
            * '기타 우려 사항 또는 질문'이 제공되었다면 명시적으로 분석하십시오.
            * 제기된 질문이나 우려 사항을 진단적 관점에서 분석하여, 각 우려 사항이 무엇을 나타낼 수 있는지, 그리고 어떤 추가 조사가 필요한지 설명하십시오. 우려 사항이 너무 모호하다면 명확화가 필요하다고 명시하십시오.

        Format: 명확한 제목을 사용하고, 목록은 글머리 기호를 사용하십시오. 모든 내용은 한국어로만 제공하며, 핵심 용어나 구문 뒤에 영어 번역을 괄호 안에 넣는 것을 엄격히 금지합니다. 간결하고 직접적인 표현을 사용하고, 모호한 표현은 피하십시오.
        `;
    }

    try {
        const result = await model.generateContent(prompt, {
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
        });
        const response = await result.response;
        const text = response.text();
        res.json({ diagnosticResult: text });

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        res.status(500).json({ error: 'Failed to generate diagnostic insights from AI.', details: error.message });
    }
});

app.get('/', (req, res) => {
    res.send('Backend is running!');
});

app.listen(port, () => {
    console.log(`Backend listening at http://localhost:${port}`);
});