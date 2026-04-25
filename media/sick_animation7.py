from manim import *
import numpy as np

class demonstration3(Scene):
    def construct(self):
        c = Circle().scale(0.1)
        c.set_fill(WHITE, opacity = 1)
        c.set_stroke(RED, width = 7)

        s = SurroundingRectangle(c, color = RED, corner_radius = 0.1)

        t = Text("Hello there", font_size = 32, font = "Sentient")
        t.next_to(c, RIGHT)
        t[0:5].set_color(GOLD)
        t[5:].set_color(TEAL)

        g1 = VGroup(c, s)
        g2 = VGroup(g1, t)
        g2.arrange()

        self.play(GrowFromCenter(c), SpinInFromNothing(s))

        self.play(Write(t))


        self.play(GrowFromCenter(c), SpinInFromNothing(s))
        self.play(Write(t))

        square = Square(side_length = 1.2).shift(RIGHT * 0.955)

        g3 = VGroup(square, t[5:])

        self.play(Write(square))
        self.play(g3.animate.next_to(t[0:5], DOWN), g1.animate.next_to(t[0:5], UP))

        self.play(square.animate.scale(3).move_to(ORIGIN), g2.animate.move_to(ORIGIN), t[5:].animate.move_to(ORIGIN).shift(DOWN * 0.3))

        dot  = Dot(color = RED).scale(0.5).move_to(ORIGIN)
        g4 = VGroup(g2, square)
        self.play(Transform(g4, dot))
        self.wait()
        self.play(dot.animate.scale(300))
        self.play(dot.animate.set_color(WHITE))
                  
        self.wait(3)

