#!/usr/bin/env python3
"""Read-only finishing settings from saved sliced 3MF; no slicing or profile edits.
Exit 0 success, 2 input/error. Configured speed is a limit, not achieved velocity.
"""
import argparse,hashlib,json,re,sys,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
KEYS='layer_height initial_layer_print_height wall_loops outer_wall_speed outer_wall_acceleration outer_wall_line_width inner_wall_speed inner_wall_acceleration enable_overhang_speed overhang_1_4_speed overhang_2_4_speed overhang_3_4_speed overhang_4_4_speed overhang_totally_speed bridge_speed enable_overhang_bridge_fan overhang_fan_speed fan_min_speed fan_max_speed additional_cooling_fan_speed slow_down_for_layer_cooling slow_down_layer_time slow_down_min_speed support_type support_style support_interface_top_layers support_interface_bottom_layers support_interface_spacing support_bottom_interface_spacing support_interface_speed support_top_z_distance support_bottom_z_distance support_object_xy_distance seam_position seam_placement_away_from_overhangs seam_slope_type nozzle_temperature nozzle_temperature_initial_layer ironing_type'.split()
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('source',nargs='?',type=Path,default=ROOT/'modelos/lancha-rounded-fenders-p1s-sliced.3mf');a=ap.parse_args()
 with zipfile.ZipFile(a.source) as z:gcode=z.read('Metadata/plate_1.gcode').decode()
 settings={}
 for k in KEYS:
  match=re.search(r'^; '+re.escape(k)+r' = (.*)$',gcode,re.M)
  settings[k]=match.group(1) if match else None
 print(json.dumps({'source':a.source.name,'source_sha256':hashlib.sha256(a.source.read_bytes()).hexdigest(),'settings':settings,'interpretation':'Saved G-code settings; not proof these exact settings were used for photographed print. Speed/acceleration values are configured limits, not measured machine velocity. No automatic diagnosis of flow, moisture or vibration.'},indent=2,sort_keys=True))
if __name__=='__main__':
 try:main()
 except Exception as e:print(str(e),file=sys.stderr);sys.exit(2)
