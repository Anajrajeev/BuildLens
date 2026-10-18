"""Read-only provider checks; never print credentials or raw request URLs."""
from google import genai
from app.core.config import get_settings
from app.core.firebase import database
from google.genai import types
from app.ai.schemas import Answer, RiskOutput

s = get_settings()
print('Firestore collections:', [c.id for c in database().collections(timeout=20)])
with genai.Client(api_key=s.gemini_api_key) as client:
    try:
        for schema, prompt in ((Answer, 'Return an empty answer with one missing-information note.'), (RiskOutput, 'Return an empty risk list.')):
            answer = client.models.generate_content(model=s.gemini_model, contents=prompt, config=types.GenerateContentConfig(response_mime_type='application/json', response_json_schema=schema.model_json_schema()))
            schema.model_validate_json(answer.text)
            print(schema.__name__ + ' structured output:', True)
    except Exception as error:
        message = str(getattr(error, 'message', ''))
        if s.gemini_api_key:
            message = message.replace(s.gemini_api_key, '[redacted]')
        print('Gemini status:', getattr(error, 'code', type(error).__name__))
        print('Provider explanation:', message[:1600])
        for attr in ('details', 'response_json', 'response'):
            value = getattr(error, attr, None)
            if value is not None:
                if hasattr(value, 'json'):
                    try:
                        value = value.json()
                    except Exception:
                        value = type(value).__name__
                print('Provider detail:', str(value).replace(s.gemini_api_key, '[redacted]')[:1800])
