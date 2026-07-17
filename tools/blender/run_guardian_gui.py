import sys

script_path = "/Users/abishek/Documents/Codex/2026-07-14/build/tools/blender/create-aegis-character.py"
sys.argv = ["create-aegis-character.py", "--actor", "guardian"]
exec(compile(open(script_path).read(), script_path, "exec"), {"__file__": script_path, "__name__": "__main__"})
