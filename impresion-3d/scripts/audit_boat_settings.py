#!/usr/bin/env python3
"""Read-only Bambu project audit, including GUI override metadata.
Exit 0: expected finishing overrides preserved; 1: findings; 2: input error.
Optional --sliced checks effective G-code settings separately; never slices.
"""
import argparse,hashlib,json,re,sys,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
GROUPS={
 'identity':'printer_model printer_settings_id print_settings_id inherits_group different_settings_to_system nozzle_diameter filament_settings_id filament_type',
 'quality':'layer_height initial_layer_print_height line_width outer_wall_line_width inner_wall_line_width resolution wall_generator wall_sequence seam_position seam_slope_type ironing_type',
 'strength':'wall_loops sparse_infill_density sparse_infill_pattern top_shell_layers top_shell_thickness bottom_shell_layers bottom_shell_thickness infill_wall_overlap ensure_vertical_shell_thickness',
 'speed':'outer_wall_speed outer_wall_acceleration inner_wall_speed inner_wall_acceleration sparse_infill_speed internal_solid_infill_speed top_surface_speed top_surface_acceleration small_perimeter_speed small_perimeter_threshold bridge_speed enable_overhang_speed overhang_1_4_speed overhang_2_4_speed overhang_3_4_speed overhang_4_4_speed initial_layer_speed initial_layer_infill_speed default_acceleration travel_speed travel_acceleration',
 'support':'enable_support support_type support_style support_threshold_angle support_on_build_plate_only support_critical_regions_only support_remove_small_overhang bridge_no_support support_interface_top_layers support_interface_bottom_layers support_interface_spacing support_bottom_interface_spacing support_top_z_distance support_bottom_z_distance support_object_xy_distance support_speed support_interface_speed independent_support_layer_height brim_type brim_width',
 'filament':'filament_max_volumetric_speed nozzle_temperature nozzle_temperature_initial_layer textured_plate_temp textured_plate_temp_initial_layer fan_min_speed fan_max_speed additional_cooling_fan_speed overhang_fan_speed enable_overhang_bridge_fan slow_down_for_layer_cooling slow_down_layer_time slow_down_min_speed close_fan_the_first_x_layers'}
EXPECTED={'outer_wall_speed':'70','outer_wall_acceleration':'2000','support_interface_top_layers':'3','support_interface_spacing':'0.25'}
def active(value):return value[0] if isinstance(value,list) and value else value
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('source',nargs='?',type=Path,default=ROOT/'modelos/lancha-rounded-fenders-fine-finish-p1s.3mf');ap.add_argument('--sliced',type=Path);a=ap.parse_args()
 with zipfile.ZipFile(a.source) as z:c=json.loads(z.read('Metadata/project_settings.config'))
 declared=set(active(c.get('different_settings_to_system',[''])).split(';'));findings=[]
 for key,value in EXPECTED.items():
  if str(active(c.get(key)))!=value:findings.append('Unexpected active value: '+key)
  if key not in declared:findings.append('Missing GUI override declaration: '+key)
 report={'source':a.source.name,'source_sha256':hashlib.sha256(a.source.read_bytes()).hexdigest(),'active_project_settings':{group:{k:active(c.get(k)) for k in keys.split()} for group,keys in GROUPS.items()},'declared_process_overrides':sorted(declared),'findings':findings}
 if a.sliced:
  with zipfile.ZipFile(a.sliced) as z:g=z.read('Metadata/plate_1.gcode').decode()
  effective={}
  for key,value in EXPECTED.items():
   match=re.search(r'^; '+re.escape(key)+r' = (.*)$',g,re.M);effective[key]=match.group(1) if match else None
   if effective[key]!=value:findings.append('Unexpected sliced value: '+key)
  report['sliced_sha256']=hashlib.sha256(a.sliced.read_bytes()).hexdigest();report['effective_gcode_settings']=effective
 report['status']='PASS' if not findings else 'FAIL';print(json.dumps(report,indent=2,sort_keys=True));return int(bool(findings))
if __name__=='__main__':
 try:sys.exit(main())
 except Exception as e:print(str(e),file=sys.stderr);sys.exit(2)
