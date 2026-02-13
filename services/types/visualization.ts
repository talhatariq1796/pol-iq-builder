export type VisualizationType = 
  | 'combined'    // Shows combined correlation visualization
  | 'primary'     // Shows primary variable only
  | 'comparison'  // Shows comparison variable only
  | 'local'       // Shows local correlation strength
  | 'hotspots'    // Shows hot/cold spots
  | 'outliers';   // Shows spatial outliers 