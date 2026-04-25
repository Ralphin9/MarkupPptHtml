@echo off
REM Activate the virtual environment
call .venv\Scripts\activate.bat
REM Render the animation using manim (use full path to python -m manim)
.venv\Scripts\python.exe -m manim render media\sick_animation.py
pause
