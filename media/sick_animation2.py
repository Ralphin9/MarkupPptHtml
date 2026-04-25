from manim import *

class demo2(Scene):
    def construct(self):
        t = Tex("Hello ", "there ", "d", "o", "g")
        t[2].color = RED
        t[3].color = ORANGE
        t[4].color = YELLOW

        self.play(Write(t[2:5]))
        self.play(Write(t[0:2]))

        self.play(t[0].animate.to_edge(UL, buff = 1), t[1].animate.to_edge(UR, buff = 1))

        self.play(t[2].animate.move_to([0, 2, 0]), t[3].animate.move_to([0, 0, 0]), t[4].animate.move_to([0, -2, 0]))

        f = Rectangle(height = 1, width = 1).move_to([0, 2, 0])
        c = Circle(radius = 0.5)
        p = RegularPolygon(5).move_to([0, -2, 0]).scale(0.5)

        self.play(SpinInFromNothing(f), Write(c), SpinInFromNothing(p))

        fcp = VGroup(f, c, p)

        self.play(Rotate(fcp, angle = PI*3))

        tp = VGroup(p, t[2])
        tf = VGroup(f, t[4])

        self.play(Swap(tp, tf))

        bye = Text("Bye", font_size = 60)
        group = VGroup(t, fcp)

        fcp = VGroup(f, c, p)

        self.play(Rotate(fcp, angle = PI*3))

        tp = VGroup(p, t[2])
        tf = VGroup(f, t[4])

        self.play(Swap(tp, tf))

        self.wait(3)

