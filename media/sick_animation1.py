from manim import *

class demo1(Scene):
    def construct(self):
        # 1. Setup objects
        s = Circle(radius = 0.5, stroke_width = 10, color = RED, fill_opacity = 0.3)
        r = SurroundingRectangle(s, color = BLUE, corner_radius = 0.1)
        t = Text("Manim").next_to(r, UP, buff = 0.5)

        self.play(Write(s), DrawBorderThenFill(r), Write(t))

        # 2. Grouping and Movement
        shrek = VGroup(s, r)
        self.play(t.animate.move_to([-4, 0, 0]), shrek.animate.move_to([4, 0, 0]))

        # 3. Dynamic Arrow with StealthTips (Merged Part)
        arrow = always_redraw(lambda: Line(
            buff = 0.4, 
            start = shrek.get_left(), 
            end = t.get_right()
        ).add_tip(tip_shape = StealthTip).add_tip(at_start = True, tip_shape = StealthTip))
        
        self.play(Write(arrow))

        # 4. Transformations
        self.play(Indicate(t, 1.5, color = ORANGE))
        self.play(Rotate(r, angle = PI/2), ScaleInPlace(s, 2))
        self.play(shrek.animate.move_to([0, 0, 0]))

        # 5. Exit sequence
        self.play(FadeOut(arrow), FadeOut(t), run_time = 0.25)
        self.play(ShrinkToCenter(r), ScaleInPlace(s, 30))
        self.play(FadeOut(s))

        self.wait()
