from manim import *

class valuetracker(Scene):
    def construct(self):
        t1 = ValueTracker(100)

        number = always_redraw(lambda: DecimalNumber(t1.get_value(), num_decimal_places = 0))

        self.play(Write(number))
        self.play(t1.animate.set_value(30), run_time = 5)
        # self.play(t1.animate.set_value(30), run_time = 5, rate_func = rate_functions.linear)
        # self.play(t1.animate.set_value(30), run_time = 5, rate_func = rate_functions.smooth)
        # self.play(t1.animate.set_value(30), run_time = 5, rate_func = rate_functions.slow_into_slow_out)

        self.wait(3)
