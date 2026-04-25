from manim import *
 

class axes2(Scene):
    def construct(self):
        axes = Axes(x_range = (-1, 10), y_range = (-1, 10), x_length = 13, y_length = 5, tips = False).add_coordinates().set_color(BLUE)
        x = axes.get_x_axis_label("x")
        y = axes.get_y_axis_label("y")

        self.play(Write(axes), Write(x), Write(y))
        dot = Dot(color = RED).move_to(axes.c2p(3, 1))
        dot_label = Text("Dot", font_size = 24).next_to(dot, UP)

        # dot_label.add_updater(lambda m: m.next_to(dot, UP))
        # self.play(Write(dot_label), Write(dot))
        # self.play(dot.animate.move_to(axes.c2p(9, 6)))


        gruop = VGroup(dot, dot_label)
        self.play(Write(gruop))
        self.play(gruop.animate.move_to(axes.c2p(9, 6)))

        dot_label.clear_updaters()
        group = VGroup(axes, x, y, dot, dot_label)
        self.play(group.animate.scale(0.3).to_edge(UL))



        self.wait(3)


