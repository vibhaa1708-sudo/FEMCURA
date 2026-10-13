from pathlib import Path
import os

from io import BytesIO



import joblib

from fastapi import FastAPI, UploadFile, File, HTTPException

from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel, Field

from pypdf import PdfReader
from dotenv import load_dotenv
from supabase import create_client, Client





# --------------------------------------------------

# PATHS AND MODEL LOADING

# --------------------------------------------------



BASE_DIR = Path(__file__).resolve().parent.parent

# --------------------------------------------------
# SUPABASE CONFIGURATION
# --------------------------------------------------

load_dotenv(BASE_DIR / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client | None = None

if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("Supabase client initialized.")
    except Exception as error:
        print(f"Supabase initialization failed: {error}")
else:
    print("Supabase credentials not configured. Database features disabled.")

MODEL_DIR = BASE_DIR / "ml" / "models"



POLICY_MODEL_PATH = MODEL_DIR / "verified_policy_label.joblib"

STUDY_MODEL_PATH = MODEL_DIR / "verified_study_label.joblib"





def load_model(path: Path):

    if not path.exists():

        return None



    try:

        return joblib.load(path)

    except Exception as error:

        print(f"Could not load model {path.name}: {error}")

        return None





policy_model = load_model(POLICY_MODEL_PATH)

study_model = load_model(STUDY_MODEL_PATH)





# --------------------------------------------------

# FASTAPI APP

# --------------------------------------------------



app = FastAPI(

    title="FEMCURA API",

    description="Evidence-led women's health research platform",

    version="0.2.0",

)



app.add_middleware(

    CORSMiddleware,

    allow_origins=[

        "http://localhost:5173",

        "http://127.0.0.1:5173",

    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],

)





# --------------------------------------------------

# REQUEST SCHEMA

# --------------------------------------------------



class PassageRequest(BaseModel):

    text: str = Field(

        ...,

        min_length=1,

        max_length=20000,

        description="Research passage to classify",

    )





# --------------------------------------------------

# BASIC ROUTES

# --------------------------------------------------



@app.get("/")

def home():

    return {

        "message": "FEMCURA backend is running!",

        "status": "success",

    }





@app.get("/health")

def health_check():

    return {

        "status": "healthy",

        "service": "FEMCURA API",

        "policy_model_loaded": policy_model is not None,

        "study_model_loaded": study_model is not None,

    }





@app.get("/db-health")
def database_health_check():
    if supabase is None:
        raise HTTPException(
            status_code=503,
            detail="Supabase is not configured.",
        )

    try:
        response = (
            supabase.table("research_papers")
            .select("id")
            .limit(1)
            .execute()
        )
        return {
            "status": "connected",
            "message": "Supabase database query successful.",
            "rows_checked": len(response.data),
        }
    except Exception as error:
        print(f"Supabase database test failed: {error!r}")
        raise HTTPException(
            status_code=500,
            detail=f"Supabase query failed: {str(error)}"
        )


# --------------------------------------------------

# EXISTING PDF ANALYSIS ROUTE

# --------------------------------------------------



@app.post("/analyze-paper")

async def analyze_paper(file: UploadFile = File(...)):

    if not file.filename or not file.filename.lower().endswith(".pdf"):

        raise HTTPException(

            status_code=400,

            detail="Please upload a PDF file.",

        )



    try:

        contents = await file.read()



        if not contents:

            raise HTTPException(

                status_code=400,

                detail="The uploaded PDF is empty.",

            )



        reader = PdfReader(BytesIO(contents))



        if reader.is_encrypted:

            raise HTTPException(

                status_code=400,

                detail="Encrypted PDFs are not supported.",

            )



        pages = []



        for page_number, page in enumerate(reader.pages, start=1):

            extracted_text = page.extract_text() or ""



            pages.append({

                "page": page_number,

                "text": extracted_text,

            })



        full_text = "\n".join(

            page["text"] for page in pages

        ).strip()



        if not full_text:

            raise HTTPException(

                status_code=422,

                detail=(

                    "No extractable text found. "

                    "The PDF may be scanned."

                ),

            )



        saved_paper = None

        if supabase is not None:
            try:
                paper_record = {
                    "title": Path(file.filename).stem,
                    "source_filename": file.filename,
                    "extracted_text": full_text,
                }
                insert_response = (
                    supabase.table("research_papers")
                    .insert(paper_record)
                    .execute()
                )
                if insert_response.data:
                    saved_paper = insert_response.data[0]
            except Exception as error:
                print(f"Could not save research paper to Supabase: {error}")
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "The PDF text was extracted, but saving the paper to "
                        "the database failed. Check Supabase table permissions "
                        "and RLS policies."
                    ),
                )

        return {
            "filename": file.filename,
            "total_pages": len(pages),
            "extracted_characters": len(full_text),
            "pages": pages,
            "saved_to_database": saved_paper is not None,
            "paper_id": saved_paper["id"] if isinstance(saved_paper, dict) and "id" in saved_paper else None,
        }



    except HTTPException:

        raise

    except Exception:

        raise HTTPException(

            status_code=400,

            detail="Could not read this PDF.",

        )

    finally:

        await file.close()





# --------------------------------------------------

# NEW ML PREDICTION ROUTE

# --------------------------------------------------



@app.post("/predict-passage")

def predict_passage(request: PassageRequest):

    text = request.text.strip()



    if not text:

        raise HTTPException(

            status_code=400,

            detail="Passage text cannot be empty.",

        )



    if policy_model is None or study_model is None:

        raise HTTPException(

            status_code=503,

            detail=(

                "One or both ML models could not be loaded. "

                "Check ml/models/ and restart the backend."

            ),

        )



    try:

        policy_prediction = str(policy_model.predict([text])[0])

        study_prediction = str(study_model.predict([text])[0])



        policy_probabilities = policy_model.predict_proba([text])[0]

        policy_classes = policy_model.named_steps[

            "classifier"

        ].classes_



        study_probabilities = study_model.predict_proba([text])[0]

        study_classes = study_model.named_steps[

            "classifier"

        ].classes_



        policy_confidence = float(

            max(policy_probabilities)

        )

        study_confidence = float(

            max(study_probabilities)

        )



        return {

            "policy_discussion": {

                "prediction": policy_prediction,

                "model_score": round(policy_confidence, 4),

                "score_note": (

                    "Model score, not a calibrated probability "

                    "or evidence of scientific correctness."

                ),

            },

            "study_reporting": {

                "prediction": study_prediction,

                "model_score": round(study_confidence, 4),

                "score_note": (

                    "Model score, not a calibrated probability "

                    "or evidence of scientific correctness."

                ),

            },

            "experimental_notice": (

                "Predictions use AI-assisted draft labels and "

                "are not independently validated. Do not use "

                "as clinical advice or definitive evidence "

                "about a research paper."

            ),

        }



    except Exception as error:

        print(f"Prediction error: {error}")

        raise HTTPException(

            status_code=500,

            detail="Could not generate predictions for this passage.",

        )

# --------------------------------------------------

# RESEARCH GAP INSIGHTS ROUTE

# --------------------------------------------------



class ResearchGapRequest(BaseModel):

    passages: list[str] = Field(

        ...,

        min_length=1,

        max_length=200,

        description="Extracted passages from a research paper",

    )





@app.post("/research-gap-insights")

def research_gap_insights(request: ResearchGapRequest):

    cleaned_passages = [

        passage.strip()

        for passage in request.passages

        if passage and passage.strip()

    ]



    if not cleaned_passages:

        raise HTTPException(

            status_code=400,

            detail="Please provide at least one non-empty passage.",

        )



    if policy_model is None or study_model is None:

        raise HTTPException(

            status_code=503,

            detail="ML models are unavailable. Check ml/models/.",

        )



    try:

        policy_predictions = policy_model.predict(cleaned_passages)

        study_predictions = study_model.predict(cleaned_passages)



        evidence = []



        for index, passage in enumerate(cleaned_passages):

            policy_label = str(policy_predictions[index])

            study_label = str(study_predictions[index])



            if policy_label == "yes" and study_label == "no":

                category = "Potential Evidence Gap"

                explanation = (

                    "This passage may discuss research inclusion "

                    "without clearly reporting the current paper's "

                    "own study evidence. Review the original context."

                )



            elif policy_label == "yes" and study_label == "yes":

                category = "Inclusion and Study Evidence"

                explanation = (

                    "This passage may discuss research inclusion "

                    "and report the current paper's own study evidence."

                )



            elif policy_label == "no" and study_label == "yes":

                category = "Study Evidence Found"

                explanation = (

                    "This passage may report the current paper's own "

                    "study evidence without explicitly discussing "

                    "research inclusion."

                )



            else:

                category = "Needs Manual Review"

                explanation = (

                    "The model did not identify a clear inclusion "

                    "and study-evidence pattern. Human review is needed."

                )



            evidence.append({

                "passage_number": index + 1,

                "category": category,

                "policy_prediction": policy_label,

                "study_prediction": study_label,

                "explanation": explanation,

                "original_passage": passage,

            })



        category_counts = {}



        for item in evidence:

            category = item["category"]

            category_counts[category] = (

                category_counts.get(category, 0) + 1

            )



        return {

            "total_passages_reviewed": len(evidence),

            "category_counts": category_counts,

            "evidence": evidence,

            "notice": (

                "These are exploratory AI-generated indicators, "

                "not confirmed scientific research gaps. Model "

                "predictions may be incorrect. Review original "

                "papers and consult qualified researchers before "

                "drawing conclusions."

            ),

        }



    except Exception as error:

        print(f"Research gap analysis error: {error}")

        raise HTTPException(

            status_code=500,

            detail="Could not generate research gap insights.",

        )
