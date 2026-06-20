import PlaceScheduleDialog from './PlaceScheduleDialog';
import SerialScheduleDialog from './SerialScheduleDialog';

export default function ScheduleDialog(props) {
  if (props.gridMode === 'place') {
    return <PlaceScheduleDialog {...props} />;
  }

  return <SerialScheduleDialog {...props} />;
}
