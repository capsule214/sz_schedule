<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
  /** 年度末（3/31 23:59:59）の Carbon を返す */
  private function fiscalYearEnd(): Carbon
  {
    $now  = Carbon::now();
    // 4月以降なら翌年3月末、1〜3月なら当年3月末
    $year = $now->month >= 4 ? $now->year + 1 : $now->year;
    return Carbon::create($year, 3, 31, 23, 59, 59);
  }

  /** ログイン（ID: admin, Password: 12345） */
  public function login(Request $request)
  {
    $request->validate([
      'loginId'  => 'required|string',
      'password' => 'required|string',
      'remember' => 'nullable|boolean',
    ]);

    $remember = (bool) $request->input('remember', false);

    // email フィールドにログインIDを格納している
    $credentials = [
      'email'    => $request->input('loginId'),
      'password' => $request->input('password'),
    ];

    if (!Auth::attempt($credentials, $remember)) {
      return response()->json(['message' => 'IDまたはパスワードが正しくありません'], 401);
    }

    $request->session()->regenerate();

    if ($remember) {
      // セッションクッキーの有効期限を年度末までの分数に設定
      // StartSession ミドルウェアがレスポンス送出時にこの値でクッキーを発行する
      $minutes = (int) Carbon::now()->diffInMinutes($this->fiscalYearEnd());
      config(['session.lifetime' => max(1, $minutes)]);
      config(['session.expire_on_close' => false]);
    }

    return response()->json(['user' => Auth::user()->only('name', 'email')]);
  }

  /** ログアウト */
  public function logout(Request $request)
  {
    Auth::guard('web')->logout();
    $request->session()->invalidate();
    $request->session()->regenerateToken();

    return response()->json(['message' => 'ログアウトしました']);
  }

  /** 現在のログインユーザー確認 */
  public function me(Request $request)
  {
    return response()->json(['user' => $request->user()->only('name', 'email')]);
  }
}
