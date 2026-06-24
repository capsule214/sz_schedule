import PlaceScheduleDialog from './PlaceScheduleDialog';
import SerialScheduleDialog from './SerialScheduleDialog';
import MorderScheduleDialog from './MorderScheduleDialog';

export default function ScheduleDialog(props) {
  if (props.gridMode === 'place') {
    return <PlaceScheduleDialog {...props} />;
  }

  const morderId = props.plan?.morderId ?? props.initialData?.morderId;
  if (Number(morderId) > 0) {
    return <MorderScheduleDialog {...props} />;
  }

  return <SerialScheduleDialog {...props} />;
}
