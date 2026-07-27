"""Test workout texts and expected outputs."""

WORKOUTS = {
    "simple": """3 rounds of:
20 air squats
15 pushups
10 burpees
rest 1 minute""",
    "complex": """12min Core Circuit
 1' plank
30" side plank
30" rest
1' dead bugs
30" leg lift
30" rest
1' butterfly kicks
30" hollow hold
30" rest
30" side plank
30" rest
1' dead bugs
30" leg lifts
30" rest
1' hollow hold
30" bird dogs
30" rest
1' shoulder taps
30" up downs
30" rest
1' plank
30" side plank""",
}

EXPECTED = {
    "simple": {
        "exercises": [
            {
                "type": "loop",
                "rounds": 3,
                "exercises": [
                    {"type": "numeric", "name": "air squats", "count": 20},
                    {"type": "numeric", "name": "pushups", "count": 15},
                    {"type": "numeric", "name": "burpees", "count": 10},
                    {"type": "rest", "duration": 60},
                ],
            }
        ]
    },
}
