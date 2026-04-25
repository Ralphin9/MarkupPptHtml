from manim import *


class axes(Scene):
    def construct(self):
        axes = Axes(x_range = (-20, 20), y_range = (-15, 15))
        tri = Triangle().scale(0.3)

        tri.move_to(axes.c2p(-7, 10))

        self.play(Write(axes))
        self.play(Write(tri))
        self.wait()

        dot = Dot(color = RED)
        self.play(Create(dot))
        self.play(dot.animate.move_to(axes.c2p(7, -10)))

        self.wait(3)
