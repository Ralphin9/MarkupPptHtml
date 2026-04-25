from manim import *
import numpy as np

class things(Scene):
    def construct(self):
        a = Text("This is my first day at work")
        b = Text("Baboon")

        self.play(Write(a))

        self.play(TransformMatchingShapes(a, b), run_time = 3)

        self.wait(3)
