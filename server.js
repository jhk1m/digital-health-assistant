require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } = require('@google/generative-ai');

const app = express();
const port = 3000;

const LLM_API_KEY = process.env.LLM_API_KEY;
if (!LLM_API_KEY) {
    console.error('LLM_API_KEY is not set in .env file!');
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(LLM_API_KEY);
// FIX APPLIED: Changed model name from "gemini-pro" to "gemini-1.0-pro" to resolve 404 Not Found
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

app.use(cors());
app.use(bodyParser.json());

app.post('/generate-diagnostic', async (req, res) => {
    let answers = req.body;

    if (!answers || Object.keys(answers).length === 0) {
        return res.status(400).json({ error: 'No answers provided.' });
    }

    let symptomListForAI = ``;
    let hasMeaningfulSymptoms = false;

    const symptomMapping = {
        'throatIrritation': '목이 칼칼하거나 따끔거리는 불편함', // MODIFICATION: Removed English from here (prompt will handle it)
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
        'otherConcerns': '기타 우려 사항 또는 질문'
    };

    for (const key in answers) {
        if (symptomMapping[key]) {
            const label = symptomMapping[key];
            let value = answers[key];
            let displayValue = '';

            if (value === 'yes') {
                displayValue = '예'; // MODIFICATION: Removed English
                hasMeaningfulSymptoms = true;
            } else if (value === 'no') {
                displayValue = '아니오'; // MODIFICATION: Removed English
            }
            else if (key === 'coughType') {
                displayValue = value === 'dry' ? '마른 기침' : (value === 'phlegm' ? '가래 기침' : '기침 종류 미확인'); // MODIFICATION: Removed English
                if (value !== '') hasMeaningfulSymptoms = true;
            } else if (key === 'phlegmColor') {
                displayValue = value === 'white' ? '하얀색' : (value === 'yellow' ? '노란색' : (value === 'green' ? '초록색' : '가래 색깔 미확인')); // MODIFICATION: Removed English
                if (value !== '') hasMeaningfulSymptoms = true;
            } else if (key === 'phlegmConsistency') {
                displayValue = value === 'thin' ? '묽은 가래' : (value === 'thick' ? '끈적한 가래' : '가래 농도 미확인'); // MODIFICATION: Removed English
                if (value !== '') hasMeaningfulSymptoms = true;
            } else if (key === 'otherConcerns') {
                displayValue = value.trim() !== '' ? `"${value.trim()}"` : '내용 없음'; // MODIFICATION: Removed English
                if (value.trim() !== '') hasMeaningfulSymptoms = true;
            } else {
                displayValue = String(value);
                if (value !== '' && value !== 'no') hasMeaningfulSymptoms = true;
            }
            symptomListForAI += `- ${label}: ${displayValue}\n`;
        }
    }

    let prompt = `
    Context: 70대 고령 환자로 민감한 호흡기계 병력을 가지고 있습니다. (Elderly patient in their 70s with a history of sensitive respiratory system.)
    Task: **호흡기계 질환 전문의로서 민감한 호흡기계를 가진 환자를 수십 년간 치료해 온 경험이 있는 전문가처럼 행동하십시오.** 냉정하고, 사실에 기반하며, 간결한 의료 진단 개요를 제공하십시오. 비판적인 사례를 검토하듯이 접근하십시오. 안심시키거나 불필요한 친절은 피하십시오. 가정을 단정 짓지 말고 의문을 제기하십시오. 감정적인 표현보다는 사실, 논리, 추론을 우선하십시오. 출력은 의료 전문가를 위한 것이며, 진단 및 조치 중심이어야 합니다.

    아빠의 현제 건강에 맞춘 응답:
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
    2.  **주요 감별 진단:** 
        * 보고된 증상만을 기반으로 가장 가능성 있는 질환들을 나열하십시오. 각 질환에 대해 보고된 특정 증상과 직접적으로 연결되는 간결하고 논리적인 설명을 제공하십시오.
        * 각 질환에 대해 의료 전문가가 *반드시* 취해야 할 구체적이고 필수적인 다음 진단 조치(예: "후두경 검사를 위한 이비인후과 의뢰", "흉부 X-ray", "특정 혈액 검사", "pH 측정")를 나열하십시오.
    3.  **고령층 특이 사항:** 
        * 고령층에서 이러한 증상이 다르게 나타나거나 더 심각할 수 있는 방식을 설명하십시오 (예: 비정형적 발현, 생리적 예비력 감소, 합병증 취약성 증가).
        * 이 연령대에 특정한 증가된 위험이나 잠재적 합병증(예: 흡인성 폐렴 위험 증가, 다약제 복용 효과, 회복 지연)을 강조하십시오.
        * 고령 환자의 진단 명확성 또는 치료 접근법에 대한 특정 고려 사항을 언급하십시오.
    4.  **일반적 관리 및 주의사항:** 
        * **중요 면책 조항: 이 항목은 일반적인 지침이며, 의료적 조언이나 진단을 대체하지 않습니다. 모든 건강 관련 결정은 반드시 자격을 갖춘 의료 전문가와 상의해야 합니다.**
        * 고령 환자의 민감한 호흡기계 상황에서 증상 완화 또는 악화 방지에 도움이 될 수 있는 간결하고 증거 기반의 일반적인 주의사항 또는 보조적 관리 방법을 제공하십시오. (예: 충분한 수분 섭취, 연기/먼지 등 알려진 자극물 피하기, 공기 가습, 역류를 위한 수면 중 머리 높이기, 적절한 식단 및 영양 섭취, 약물 부작용 검토). 구체적인 치료법이나 처방은 피하십시오.
    5.  **잠재적 맹점 / 누락:**
        * 포괄적인 진단에 필수적이거나 현재 평가를 크게 바꿀 수 있는, 설문에서 제공되지 않은 중요한 정보나 증상을 지적하십시오.
        * 어떤 세부 정보가 누락되었으며 왜 중요한지 명시하십시오.
    6.  **기타 우려 사항 분석:**
        * '기타 우려 사항 또는 질문'이 제공되었다면 명시적으로 분석하십시오.
        * 제기된 질문이나 우려 사항을 진단적 관점에서 분석하여, 각 우려 사항이 무엇을 나타낼 수 있는지, 그리고 어떤 추가 조사가 필요한지 설명하십시오. 우려 사항이 너무 모호하다면 명확화가 필요하다고 명시하십시오.

    Format: 명확한 제목을 사용하고, 목록은 글머리 기호를 사용하십시오. 모든 내용은 한국어로만 제공하며, 핵심 용어나 구문 뒤에 영어 번역을 괄호 안에 넣는 것을 엄격히 금지합니다. 간결하고 직접적인 표현을 사용하고, 모호한 표현은 피하십시오.
    `; // MODIFICATION: Updated Format instructions to be Korean only, no English in parentheses.
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