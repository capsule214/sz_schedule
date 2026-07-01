<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CalendarController;
use App\Http\Controllers\Api\DisplaySettingsController;
use App\Http\Controllers\Api\DprController;
use App\Http\Controllers\Api\MorderController;
use App\Http\Controllers\Api\PlanController;
use App\Http\Controllers\Api\QualificationController;
use App\Http\Controllers\Api\ReserveController;
use App\Http\Controllers\Api\ResourceController;
use App\Http\Controllers\Api\SeedController;
use App\Http\Controllers\Api\SerialController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\WorkerController;
use Illuminate\Support\Facades\Route;

// 認証不要
Route::post('/login', [AuthController::class, 'login']);

// 認証必須
Route::middleware('auth:web')->group(function () {
  Route::post('/logout', [AuthController::class, 'logout']);
  Route::get('/me', [AuthController::class, 'me']);

  Route::get('/serial', [SerialController::class, 'index']);
  Route::post('/serial/device-groups', [SerialController::class, 'deviceGroups']);
  Route::get('/serial/kisyu', [SerialController::class, 'kisyu']);
  Route::get('/serial/kisyu/{kisyuId}', [SerialController::class, 'byKisyu']);
  Route::get('/worker', [WorkerController::class, 'index']);
  Route::get('/worker/team', [WorkerController::class, 'teams']);
  Route::get('/worker/team/{teamId}', [WorkerController::class, 'byTeam']);
  Route::get('/worker/{id}', [WorkerController::class, 'show']);
  Route::get('/task', [TaskController::class, 'index']);
  Route::get('/qualification/status', [QualificationController::class, 'status']);
  Route::get('/resource', [ResourceController::class, 'index']);
  Route::get('/morder', [MorderController::class, 'index']);
  Route::post('/morder/groups', [MorderController::class, 'groups']);

  Route::get('/plan', [PlanController::class, 'index']);
  Route::post('/plan/search', [PlanController::class, 'search']);
  Route::post('/plan/search/device', [PlanController::class, 'searchDevice']);
  Route::post('/plan/search/worker', [PlanController::class, 'searchWorker']);
  Route::post('/plan/search/task', [PlanController::class, 'searchTask']);
  Route::get('/plan/by-serial/{serialId}', [PlanController::class, 'bySerial']);
  Route::post('/plan', [PlanController::class, 'store']);
  Route::delete('/plan', [PlanController::class, 'destroy']);
  Route::put('/plan/{id}', [PlanController::class, 'update']);
  Route::delete('/plan/{id}', [PlanController::class, 'destroyOne']);

  Route::get('/display-settings', [DisplaySettingsController::class, 'index']);
  Route::put('/display-settings', [DisplaySettingsController::class, 'update']);

  Route::get('/reserve', [ReserveController::class, 'index']);
  Route::post('/reserve/search', [ReserveController::class, 'search']);
  Route::post('/reserve', [ReserveController::class, 'store']);
  Route::put('/reserve/{id}', [ReserveController::class, 'update']);
  Route::delete('/reserve', [ReserveController::class, 'destroy']);

  Route::post('/calendar/search', [CalendarController::class, 'search']);
  Route::get('/calendar', [CalendarController::class, 'index']);
  Route::post('/calendar', [CalendarController::class, 'store']);
  Route::delete('/calendar/{date}', [CalendarController::class, 'destroy']);

  Route::post('/seed', [SeedController::class, 'seed']);
  Route::post('/seed/master', [SeedController::class, 'seedMaster']);
  Route::post('/seed/plans', [SeedController::class, 'seedPlans']);
  Route::post('/seed/dpr', [SeedController::class, 'seedDpr']);

  Route::get('/dpr/machines', [DprController::class, 'machines']);
  Route::get('/dpr/locations', [DprController::class, 'salesLocations']);
  Route::get('/dpr/years', [DprController::class, 'publicationYears']);
  Route::get('/dpr/filter-options', [DprController::class, 'filterOptions']);
});
