from PIL import Image, ImageDraw, ImageFont
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import shutil
import tempfile
import urllib.request
import cv2
import numpy as np

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
FONT_PATH = BASE_DIR / "GreatVibes.ttf"

app = FastAPI()

# Allow your local HTML file to communicate with Python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all local origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def serve_frontend():
    return FileResponse(STATIC_DIR / "index.html")


def create_invitations(guest_list_path, template_image_path, output_folder, preview_path=None):
    output_folder = Path(output_folder)
    output_folder.mkdir(exist_ok=True)

    # READ THE TEXT FILE
    # This opens the file, reads all lines, and automatically closes it
    with open(guest_list_path, "r", encoding="utf-8") as file:
        # .splitlines() reads each line as a list item and removes the hidden '\n' newline characters
        guest_name_List = [name.strip() for name in file.read().splitlines() if name.strip()]

    if not guest_name_List:
        raise ValueError("Guest list contains no names")


    # Download an elegant wedding script font (Great Vibes) straight to Colab
    font_url = "https://github.com/google/fonts/raw/main/ofl/greatvibes/GreatVibes-Regular.ttf"
    if not FONT_PATH.exists():
        urllib.request.urlretrieve(font_url, FONT_PATH)

    # Choose a font and size (make sure the .ttf file is in your folder)
    # You can use any free font like Arial, GreatVibes, etc.
    font = ImageFont.truetype(FONT_PATH, size=60)


    # Load invitation image in grayscale
    img = cv2.imread(str(template_image_path), cv2.IMREAD_GRAYSCALE)

    blurred = cv2.GaussianBlur(img, (51, 1), 0)

    # Find the single row that became the darkest after blurring the dots
    y_position = int(np.argmax(np.var(blurred, axis=1)))


    # Add a small safety gap (e.g., 10 pixels) so the text doesn't touch the line
    safety_gap = 2

    # Loop through each guest in the list
    for guest in guest_name_List:

        # Open your base invitation PNG
        image = Image.open(template_image_path)
        draw = ImageDraw.Draw(image)

        # Get the total width of your invitation image
        image_width, _ = image.size

        # Remove any accidental leading/trailing spaces from the name
        guest_name = guest.strip()
            
        # Measure the exact boundaries of your text
        # getbbox returns (left, top, right, bottom) coordinates
        _, _, text_width, text_height = font.getbbox(guest_name)

        # Calculate the perfect Y position dynamically
        calculated_y = y_position - text_height - safety_gap

        # Calculate the perfectly centered X coordinate
        # (Half of image width) minus (Half of text width)
        calculated_x = int((image_width / 2) - (text_width / 2))

        # Set the exact (X, Y) coordinates where the name should appear
        # Use image.size to find dimensions if needed
        position = (calculated_x, calculated_y)

        # Write the text (using RGB code for color, e.g., (0,0,0) for Black)
        draw.text(position, guest_name, fill=(0, 0, 0), font=font)

        # Save the new personalized invitation
        if preview_path:
            image.save(preview_path)
            break

        safe_name = "".join(character for character in guest_name if character not in '<>:"/\\|?*').strip().rstrip(".")
        if safe_name:
            image.save(output_folder / f"{safe_name}.png")


@app.post("/preview")
def preview_invitation(
    guest_list: UploadFile = File(...),
    invitation_template: UploadFile = File(...),
):
    with tempfile.TemporaryDirectory(prefix="invitation_preview_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        guest_list_path = temp_dir / "guest_list.txt"
        template_image_path = temp_dir / "invitation_template.png"
        preview_path = temp_dir / "preview.png"
        output_folder = temp_dir / "output"

        with guest_list_path.open("wb") as saved_guest_list:
            shutil.copyfileobj(guest_list.file, saved_guest_list)

        with template_image_path.open("wb") as saved_template:
            shutil.copyfileobj(invitation_template.file, saved_template)

        try:
            create_invitations(guest_list_path, template_image_path, output_folder, preview_path)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

        return Response(
            content=preview_path.read_bytes(),
            media_type="image/png",
            headers={"Cache-Control": "no-store"},
        )


@app.post("/generate")
def generate_invitations(
    background_tasks: BackgroundTasks,
    guest_list: UploadFile = File(...),
    invitation_template: UploadFile = File(...),
):
    if not guest_list.filename or not guest_list.filename.lower().endswith(".txt"):
        raise HTTPException(status_code=400, detail="Guest list must be a .txt file")

    if not invitation_template.content_type or not invitation_template.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invitation template must be an image file")

    temp_dir = Path(tempfile.mkdtemp(prefix="invitation_generation_"))
    guest_list_path = temp_dir / "guest_list.txt"
    template_image_path = temp_dir / "invitation_template.png"
    output_folder = temp_dir / "output"

    try:
        with guest_list_path.open("wb") as saved_guest_list:
            shutil.copyfileobj(guest_list.file, saved_guest_list)

        with template_image_path.open("wb") as saved_template:
            shutil.copyfileobj(invitation_template.file, saved_template)

        create_invitations(guest_list_path, template_image_path, output_folder)
        zip_path = Path(shutil.make_archive(str(temp_dir / "invitations"), "zip", output_folder))
    except Exception:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise

    background_tasks.add_task(shutil.rmtree, temp_dir, ignore_errors=True)
    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename="customized_invitations.zip",
        background=background_tasks,
    )
