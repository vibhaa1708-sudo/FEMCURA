
from pathlib import Path
import csv
from pypdf import PdfReader

# Project folders
BASE_DIR = Path(__file__).resolve().parent
PDF_DIR = BASE_DIR / "data" / "research_papers"
OUTPUT_FILE = BASE_DIR / "data" / "extracted_papers.csv"

def extract_papers():
    pdf_files = sorted(PDF_DIR.glob("*.pdf"))

    if not pdf_files:
        print(f"No PDF files found in: {PDF_DIR}")
        return

    rows = []

    for pdf_file in pdf_files:
        print(f"\nProcessing: {pdf_file.name}")

        try:
            reader = PdfReader(str(pdf_file))

            for page_number, page in enumerate(reader.pages, start=1):
                text = (page.extract_text() or "").strip()

                if text:
                    rows.append({
                        "filename": pdf_file.name,
                        "page": page_number,
                        "text": text
                    })

            print(f"Pages found: {len(reader.pages)}")

        except Exception as error:
            print(f"Could not read {pdf_file.name}: {error}")

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    with OUTPUT_FILE.open("w", newline="", encoding="utf-8-sig") as csv_file:
        writer = csv.DictWriter(
            csv_file,
            fieldnames=["filename", "page", "text"]
        )
        writer.writeheader()
        writer.writerows(rows)

    print("\nExtraction complete!")
    print(f"PDF files found: {len(pdf_files)}")
    print(f"Pages with extracted text: {len(rows)}")
    print(f"Output saved to: {OUTPUT_FILE}")

if __name__ == "__main__":
    extract_papers()
